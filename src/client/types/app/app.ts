import type { DashboardGateway } from "@client/types/widgets/api";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";
import type { CLIENT_INTERFACE_MODE } from "@client/constants/shared/interface-mode";

export type ClientInterfaceMode =
  (typeof CLIENT_INTERFACE_MODE)[keyof typeof CLIENT_INTERFACE_MODE];

export interface AppProps {
  readonly api?: DashboardGateway;
  readonly filesystemApi?: FilesystemGateway;
  readonly storageStatusApi?: StorageStatusGateway;
  readonly widgetFileApi?: WidgetFileGateway;
  readonly interfaceMode?: ClientInterfaceMode;
}
