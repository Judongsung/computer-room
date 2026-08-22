import { describe, expect, it } from "vitest";
import { FILESYSTEM_ENTRY_KIND } from "../../src/constants/filesystem";
import {
  collectDirectoryHandleUploadNode,
  collectDroppedUploadNodes,
  collectSelectedUploadNodes,
} from "../../src/client/domain/local-file-tree";

describe("collectSelectedUploadNodes", () => {
  it("preserves nested relative paths selected through the folder picker", () => {
    const cover = relativeFile("cover.png", "앨범/cover.png");
    const original = relativeFile("original.png", "앨범/원본/original.png");

    const nodes = collectSelectedUploadNodes(
      [cover, original] as unknown as FileList,
    );

    expect(nodes).toEqual([
      {
        kind: "directory",
        name: "앨범",
        children: [
          { kind: "file", name: "cover.png", file: cover },
          {
            kind: "directory",
            name: "원본",
            children: [
              { kind: "file", name: "original.png", file: original },
            ],
          },
        ],
      },
    ]);
  });

  it("keeps empty directories exposed by the directory handle picker", async () => {
    const empty = directoryHandle("빈 폴더", []);
    const root = directoryHandle("자료", [empty]);

    await expect(collectDirectoryHandleUploadNode(root)).resolves.toEqual({
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name: "자료",
      children: [{ kind: "directory", name: "빈 폴더", children: [] }],
    });
  });

  it("reads every legacy directory batch until the browser returns an empty batch", async () => {
    const entries = Array.from({ length: 101 }, (_, index) =>
      legacyFileEntry(`file-${index}.txt`),
    );
    const batches = [entries.slice(0, 100), entries.slice(100), []];
    let readCount = 0;
    const directory = {
      isFile: false,
      isDirectory: true,
      name: "대용량 폴더",
      createReader: () => ({
        readEntries: (success: (batch: readonly unknown[]) => void) => {
          success(batches[readCount] ?? []);
          readCount += 1;
        },
      }),
    };
    const item = {
      kind: "file",
      webkitGetAsEntry: () => directory,
      getAsFile: () => null,
    };

    const selection = await collectDroppedUploadNodes({
      0: item,
      length: 1,
    } as unknown as DataTransferItemList);

    expect(selection.folderDropUnsupported).toBe(false);
    expect(selection.nodes[0]).toMatchObject({
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name: "대용량 폴더",
    });
    expect(
      selection.nodes[0]?.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
        ? selection.nodes[0].children
        : [],
    ).toHaveLength(101);
    expect(readCount).toBe(3);
  });
});

function relativeFile(name: string, relativePath: string): File {
  const file = new File([name], name);
  Object.defineProperty(file, "webkitRelativePath", { value: relativePath });
  return file;
}

function directoryHandle(
  name: string,
  children: readonly FileSystemHandle[],
): FileSystemDirectoryHandle {
  return {
    kind: "directory",
    name,
    async *values() {
      yield* children;
    },
  } as FileSystemDirectoryHandle;
}

function legacyFileEntry(name: string) {
  const file = new File([name], name);
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (success: (value: File) => void) => success(file),
  };
}
