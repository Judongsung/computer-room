
import { checklistRetentionApi as defaultChecklistRetentionApi } from "@client/api/widgets/checklist-retention-api-client";
import { UI_MESSAGES } from "@client/content/ko/widgets/dashboard";
import { useState, type CSSProperties } from "react";
import "xp.css/dist/XP.css";
import "@client/styles/desktop.css";
import { DesktopShell } from "@client/components/desktop/shell/desktop-shell";
import { XpWindowFrame } from "@client/components/desktop/xp-window-frame";
import { DASHBOARD_COPY, SITE_COPY } from "@client/content/ko/widgets/content";
import { LOAD_STATUS } from "@client/constants/widgets/dashboard";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { useDashboard } from "@client/hooks/widgets/use-dashboard";
import { DashboardApiClient } from "@client/api/widgets/dashboard-api-client";
import { FilesystemApiClient } from "@client/api/filesystem/filesystem-api-client";
import { StorageStatusApiClient } from "@client/api/storage/storage-status-api-client";
import type { AppProps } from "@client/types/app/app";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import { ImageUploadProfileApiClient } from "@client/api/integrations/image-upload-profile-api-client";
import type { ImageUploadProfileGateway } from "@client/types/integrations/image-upload-profile";
import { ImageUploadLogApiClient } from "@client/api/integrations/image-upload-log-api-client";
import type { ImageUploadLogGateway } from "@client/types/integrations/image-upload-log";
import { GuestAccessApiClient } from "@client/api/admin/guest-access-api-client";
import type { GuestAccessGateway } from "@client/types/admin/guest-access";
import { ThumbnailLoadProvider } from "@client/state/filesystem/thumbnail-load-context";
import { XpContextMenuProvider } from "@client/state/context-menu/context-menu-context";

const DESKTOP_BACKGROUND_STYLE = {
  "--desktop-background-image": `url("${DESKTOP_ASSET_PATHS.BACKGROUND}")`,
} as CSSProperties;

export function DesktopApplication(props: AppProps) {
  return (
    <XpContextMenuProvider>
      <ThumbnailLoadProvider>
        <DesktopApplicationContent {...props} />
      </ThumbnailLoadProvider>
    </XpContextMenuProvider>
  );
}

function DesktopApplicationContent({
  checklistRetentionApi,
  api,
  filesystemApi,
  storageStatusApi,
  imageUploadProfileApi,
  imageUploadLogApi,
  guestAccessApi,
  initialSession,
}: AppProps) {
  const checklistRetentionGateway = checklistRetentionApi ?? defaultChecklistRetentionApi;
  const [gateway] = useState<DashboardGateway>(
    () => api ?? new DashboardApiClient(),
  );
  const [filesystemGateway] = useState<FilesystemGateway>(
    () => filesystemApi ?? new FilesystemApiClient(),
  );
  const [storageStatusGateway] = useState<StorageStatusGateway>(
    () => storageStatusApi ?? new StorageStatusApiClient(),
  );
  const [imageUploadProfileGateway] = useState<ImageUploadProfileGateway>(
    () => imageUploadProfileApi ?? new ImageUploadProfileApiClient(),
  );
  const [imageUploadLogGateway] = useState<ImageUploadLogGateway>(
    () => imageUploadLogApi ?? new ImageUploadLogApiClient(),
  );
  const [guestAccessGateway] = useState<GuestAccessGateway>(
    () => guestAccessApi ?? new GuestAccessApiClient(),
  );
  const dashboard = useDashboard(gateway, initialSession);
  const { state } = dashboard;

  if (state.loadStatus === LOAD_STATUS.LOADING) {
    return (
      <main className="desktop-state" style={DESKTOP_BACKGROUND_STYLE}>
        <XpWindowFrame
          className="state-window"
          title={SITE_COPY.TITLE}
          iconPath={DESKTOP_ASSET_PATHS.START_LOGO}
          bodyClassName="state-window__body"
          aria-busy="true"
        >
          <p>{state.message?.text ?? UI_MESSAGES.LOADING}</p>
          <progress />
        </XpWindowFrame>
      </main>
    );
  }

  if (state.loadStatus === LOAD_STATUS.ERROR || !state.session) {
    return (
      <main className="desktop-state" style={DESKTOP_BACKGROUND_STYLE}>
        <XpWindowFrame
          className="state-window"
          title={SITE_COPY.TITLE}
          iconPath={DESKTOP_ASSET_PATHS.START_LOGO}
          bodyClassName="state-window__body"
        >
          <p role="alert">{state.message?.text}</p>
          <button type="button" onClick={dashboard.retry}>
            {DASHBOARD_COPY.RETRY}
          </button>
        </XpWindowFrame>
      </main>
    );
  }

  return (
    <DesktopShell
      session={state.session}
      widgets={state.widgets}
      activeWidgetId={dashboard.activeWidgetId}
      gateway={dashboard.gateway}
      filesystemGateway={filesystemGateway}
      checklistRetentionGateway={checklistRetentionGateway}
      storageStatusGateway={storageStatusGateway}
      imageUploadProfileGateway={imageUploadProfileGateway}
      imageUploadLogGateway={imageUploadLogGateway}
      guestAccessGateway={guestAccessGateway}
      layoutSaveStatus={dashboard.layoutSave.status}
      layoutSaveError={dashboard.layoutSave.error}
      message={state.message}
      onAddWidget={dashboard.addWidget}
      onOpenWidget={dashboard.openWidget}
      onSaveWidgetFile={dashboard.saveWidgetFile}
      onCloseWidget={dashboard.closeWidget}
      onDiscardWidget={dashboard.discardWidget}
      onRemoveWidgets={dashboard.removeWidgets}
      onFocusWindow={dashboard.focusWindow}
      onMinimizeWindow={dashboard.minimizeWindow}
      onToggleMaximizeWindow={dashboard.toggleMaximizeWindow}
      onActivateTaskbarWindow={dashboard.activateTaskbarWindow}
      onCommitWindowBounds={dashboard.commitWindowBounds}
      onWidgetChange={dashboard.updateWidget}
      onRetrySave={dashboard.layoutSave.retry}
      onDismissMessage={dashboard.dismissMessage}
    />
  );
}
