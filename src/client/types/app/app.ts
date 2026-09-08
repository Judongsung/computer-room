import type { ChecklistRetentionUseCases } from "@/types/widgets/checklist/retention";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";
import type { CLIENT_INTERFACE_MODE } from "@client/constants/shared/interface-mode";
import type { MobilePreferencesGateway } from "@client/types/platform/mobile-preferences";
import type { ImageUploadProfileGateway } from "@client/types/integrations/image-upload-profile";
import type { ImageUploadLogGateway } from "@client/types/integrations/image-upload-log";
import type { GuestAccessGateway } from "@client/types/admin/guest-access";
import type { GuestGateway } from "@client/types/guest/guest";
import type { ClientAccessMode } from "@client/types/platform/access";
import type { SessionInfo } from "@/types/platform/auth";

export type ClientInterfaceMode =
  (typeof CLIENT_INTERFACE_MODE)[keyof typeof CLIENT_INTERFACE_MODE];

export interface AppProps {
  readonly checklistRetentionApi?: ChecklistRetentionUseCases;
  readonly api?: DashboardGateway;
  readonly filesystemApi?: FilesystemGateway;
  readonly storageStatusApi?: StorageStatusGateway;
  readonly widgetFileApi?: WidgetFileGateway;
  readonly mobilePreferencesApi?: MobilePreferencesGateway;
  readonly imageUploadProfileApi?: ImageUploadProfileGateway;
  readonly imageUploadLogApi?: ImageUploadLogGateway;
  readonly guestAccessApi?: GuestAccessGateway;
  readonly guestApi?: GuestGateway;
  readonly accessMode?: ClientAccessMode;
  readonly initialSession?: SessionInfo;
  readonly interfaceMode?: ClientInterfaceMode;
}
