import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type {
  LocalUploadDirectoryNode,
  LocalUploadNode,
  LocalUploadSelection,
} from "@client/types/filesystem/upload";

interface BrowserFileSystemEntry {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly name: string;
}

interface BrowserFileSystemFileEntry extends BrowserFileSystemEntry {
  file(
    success: (file: File) => void,
    failure?: (error: DOMException) => void,
  ): void;
}

interface BrowserFileSystemDirectoryReader {
  readEntries(
    success: (entries: readonly BrowserFileSystemEntry[]) => void,
    failure?: (error: DOMException) => void,
  ): void;
}

interface BrowserFileSystemDirectoryEntry extends BrowserFileSystemEntry {
  createReader(): BrowserFileSystemDirectoryReader;
}

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => BrowserFileSystemEntry | null;
  getAsEntry?: () => BrowserFileSystemEntry | null;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

export function supportsDirectoryHandlePicker(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

export async function selectDirectoryUploadNode(): Promise<LocalUploadDirectoryNode | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    return null;
  }
  return collectDirectoryHandleUploadNode(await picker.call(window));
}

export async function collectDirectoryHandleUploadNode(
  handle: FileSystemDirectoryHandle,
): Promise<LocalUploadDirectoryNode> {
  const children: LocalUploadNode[] = [];
  for await (const child of handle.values()) {
    if (child.kind === "file") {
      const file = await (child as FileSystemFileHandle).getFile();
      children.push({
        kind: FILESYSTEM_ENTRY_KIND.FILE,
        name: child.name,
        file,
      });
    } else {
      children.push(
        await collectDirectoryHandleUploadNode(
          child as FileSystemDirectoryHandle,
        ),
      );
    }
  }
  return {
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: handle.name,
    children,
  };
}

export async function collectDroppedUploadNodes(
  items: DataTransferItemList,
): Promise<LocalUploadSelection> {
  const nodes: LocalUploadNode[] = [];
  let folderDropUnsupported = false;

  for (const item of Array.from(items)) {
    if (item.kind !== "file") continue;
    const extended = item as DataTransferItemWithEntry;
    const entry = extended.getAsEntry?.() ?? extended.webkitGetAsEntry?.();
    if (entry) {
      nodes.push(await readEntry(entry));
      continue;
    }
    const file = item.getAsFile();
    if (file) {
      nodes.push({
        kind: FILESYSTEM_ENTRY_KIND.FILE,
        name: file.name,
        file,
      });
    } else {
      folderDropUnsupported = true;
    }
  }
  return { nodes, folderDropUnsupported };
}

export function collectSelectedUploadNodes(files: FileList): LocalUploadNode[] {
  const roots: MutableDirectoryNode = {
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: "",
    children: [],
  };
  for (const file of Array.from(files)) {
    const path = file.webkitRelativePath || file.name;
    const parts = path.split("/").filter(Boolean);
    let current = roots;
    for (const part of parts.slice(0, -1)) {
      let directory = current.children.find(
        (child): child is MutableDirectoryNode =>
          child.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY &&
          child.name === part,
      );
      if (!directory) {
        directory = {
          kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
          name: part,
          children: [],
        };
        current.children.push(directory);
      }
      current = directory;
    }
    current.children.push({
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      name: parts.at(-1) ?? file.name,
      file,
    });
  }
  return roots.children;
}

async function readEntry(entry: BrowserFileSystemEntry): Promise<LocalUploadNode> {
  if (entry.isFile) {
    const file = await readFile(entry as BrowserFileSystemFileEntry);
    return { kind: FILESYSTEM_ENTRY_KIND.FILE, name: entry.name, file };
  }
  const children = await readDirectory(
    entry as BrowserFileSystemDirectoryEntry,
  );
  return {
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: entry.name,
    children,
  };
}

function readFile(entry: BrowserFileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function readDirectory(
  entry: BrowserFileSystemDirectoryEntry,
): Promise<LocalUploadNode[]> {
  const reader = entry.createReader();
  const entries: BrowserFileSystemEntry[] = [];
  while (true) {
    const batch = await new Promise<readonly BrowserFileSystemEntry[]>(
      (resolve, reject) => reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) break;
    entries.push(...batch);
  }
  return Promise.all(entries.map(readEntry));
}

type MutableDirectoryNode = {
  kind: typeof FILESYSTEM_ENTRY_KIND.DIRECTORY;
  name: string;
  children: Array<MutableDirectoryNode | LocalUploadNode>;
};
