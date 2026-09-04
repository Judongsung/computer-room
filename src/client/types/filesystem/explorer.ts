import type { FilesystemEntry, FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { DesktopAppWindowProps } from "@client/types/desktop/desktop";
import type {
  FilesystemGateway,
  FilesystemWindowSyncProps,
} from "@client/types/filesystem/filesystem";
import type { LocalUploadNode } from "@client/types/filesystem/upload";

export type DocumentsDialog = "create" | "rename" | "move" | null;

export interface DocumentsWindowProps
  extends Omit<
      DesktopAppWindowProps,
      | "title"
      | "iconPath"
      | "minWidth"
      | "minHeight"
      | "toolbar"
      | "footer"
      | "bodyClassName"
      | "children"
    >,
    FilesystemWindowSyncProps {
  readonly gateway: FilesystemGateway;
  readonly windowId: string;
  readonly title: string;
  readonly iconPath: string;
  readonly onOpenFile: (entry: FilesystemFileEntry) => void;
  readonly initialDirectoryId: string;
  readonly onDirectoryChanged: (
    windowId: string,
    directoryId: string,
    title: string,
  ) => void;
  readonly onOpenWidget: (widgetId: string) => void;
  readonly onEntryChanged: (entry: FilesystemEntry) => void;
  readonly onWidgetsClosed: (widgetIds: readonly string[]) => void;
  readonly onUploadNodes: (
    nodes: readonly LocalUploadNode[],
    parentId: string,
    notice?: string | null,
  ) => Promise<void>;
  readonly desktopCapacity: number;
}
