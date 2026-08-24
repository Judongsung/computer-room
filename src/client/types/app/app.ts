import type { DashboardGateway } from "@client/types/widgets/api";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";

export interface AppProps {
  readonly api?: DashboardGateway;
  readonly filesystemApi?: FilesystemGateway;
  readonly storageStatusApi?: StorageStatusGateway;
}
