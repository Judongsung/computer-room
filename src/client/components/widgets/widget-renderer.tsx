import { lazy } from "react";

import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";
import type { WidgetWindowControls } from "@client/types/desktop/window";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { ImageUploadProfileGateway } from "@client/types/integrations/image-upload-profile";
import type { ImageUploadLogGateway } from "@client/types/integrations/image-upload-log";
import type { GuestAccessGateway } from "@client/types/admin/guest-access";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { ChecklistRetentionUseCases } from "@/types/widgets/checklist/retention";
import { assertNever } from "@/domain/shared/assert-never";
import { LazyFeatureBoundary } from "@client/components/shared/lazy-feature-boundary";
import { WIDGET_TITLE_BY_TYPE } from "@client/content/ko/widgets/content";

export interface WidgetRendererProps {
  readonly checklistRetentionGateway: ChecklistRetentionUseCases;
  readonly widget: DashboardWidget;
  readonly windowControls: WidgetWindowControls;
  readonly gateway: DashboardGateway;
  readonly storageStatusGateway: StorageStatusGateway;
  readonly imageUploadProfileGateway: ImageUploadProfileGateway;
  readonly imageUploadLogGateway: ImageUploadLogGateway;
  readonly guestAccessGateway: GuestAccessGateway;
  readonly onOpenFilesystemEntry: (entry: FilesystemEntry) => void;
  readonly onWidgetChange: (widget: DashboardWidget) => void;
}

const MemoWidget = lazy(() =>
  import("@client/components/widgets/memo-widget").then((module) => ({
    default: module.MemoWidget,
  })),
);
const DailyChecklistWidget = lazy(() =>
  import("@client/components/widgets/daily-checklist-widget").then((module) => ({
    default: module.DailyChecklistWidget,
  })),
);
const StorageStatusWidget = lazy(() =>
  import("@client/components/widgets/storage-status-widget").then((module) => ({
    default: module.StorageStatusWidget,
  })),
);
const ImageUploadProfilesWidget = lazy(() =>
  import("@client/components/widgets/image-upload-profiles-widget").then(
    (module) => ({ default: module.ImageUploadProfilesWidget }),
  ),
);
const AdminApplication = lazy(() =>
  import("@client/components/widgets/admin-application").then((module) => ({
    default: module.AdminApplication,
  })),
);

export function WidgetRenderer(props: WidgetRendererProps) {
  return (
    <LazyFeatureBoundary title={WIDGET_TITLE_BY_TYPE[props.widget.type]}>
      {renderWidget(props)}
    </LazyFeatureBoundary>
  );
}

function renderWidget(props: WidgetRendererProps) {
  const { widget, windowControls } = props;
  switch (widget.type) {
    case WIDGET_TYPE.MEMO:
      return (
        <MemoWidget
          widget={widget}
          windowControls={windowControls}
          gateway={props.gateway}
          onWidgetChange={props.onWidgetChange}
        />
      );
    case WIDGET_TYPE.DAILY_CHECKLIST:
      return (
        <DailyChecklistWidget
          widget={widget}
          windowControls={windowControls}
          gateway={props.gateway}
          onWidgetChange={props.onWidgetChange}
          checklistRetentionGateway={props.checklistRetentionGateway}
        />
      );
    case WIDGET_TYPE.STORAGE_STATUS:
      return (
        <StorageStatusWidget
          windowControls={windowControls}
          storageStatusGateway={props.storageStatusGateway}
        />
      );
    case WIDGET_TYPE.IMAGE_UPLOAD_PROFILES:
      return (
        <ImageUploadProfilesWidget
          windowControls={windowControls}
          imageUploadProfileGateway={props.imageUploadProfileGateway}
          imageUploadLogGateway={props.imageUploadLogGateway}
          onOpenFilesystemEntry={props.onOpenFilesystemEntry}
        />
      );
    case WIDGET_TYPE.ADMIN:
      return (
        <AdminApplication
          windowControls={windowControls}
          guestAccessGateway={props.guestAccessGateway}
        />
      );
    default:
      return assertNever(widget);
  }
}
