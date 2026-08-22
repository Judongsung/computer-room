import type { DashboardGateway } from "./api";
import type { FilesystemGateway } from "./filesystem";

export interface AppProps {
  readonly api?: DashboardGateway;
  readonly filesystemApi?: FilesystemGateway;
}
