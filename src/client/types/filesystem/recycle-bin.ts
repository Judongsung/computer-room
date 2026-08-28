import type { SystemWindowChromeProps } from "@client/types/desktop/system-app";
import type {
  FilesystemGateway,
  FilesystemWindowSyncProps,
} from "@client/types/filesystem/filesystem";

export type RecycleBinDialog = "delete" | "empty" | null;

export interface RecycleBinWindowProps
  extends SystemWindowChromeProps,
    FilesystemWindowSyncProps {
  readonly gateway: FilesystemGateway;
  readonly desktopCapacity: number;
}
