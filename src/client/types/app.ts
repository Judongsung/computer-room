import type { DashboardGateway } from "./api";
import type { FilesystemGateway } from "./filesystem";
import type { StorageStatusGateway } from "./storage-status";

export interface AppProps {
  readonly api?: DashboardGateway;
  readonly filesystemApi?: FilesystemGateway;
  readonly storageStatusApi?: StorageStatusGateway;
}
