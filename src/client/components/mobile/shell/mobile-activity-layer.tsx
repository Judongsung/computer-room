import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import { MobileHome } from "@client/components/mobile/launcher/mobile-home";
import {
  MobileDirectory,
  MobileMediaViewer,
  MobileRecycleBin,
  MobileStorageStatus,
  MobileWallpaperPicker,
  MobileWidgetCatalog,
  MobileWidgetDraftScreen,
  MobileWidgetFileScreen,
} from "@client/components/mobile/shell/mobile-lazy-activities";
import { MOBILE_ACTIVITY_KIND } from "@client/constants/mobile/activity";
import type { MobileShellController } from "@client/types/app/mobile-shell";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";

interface MobileActivityLayerProps {
  readonly controller: MobileShellController;
  readonly dashboard: DashboardGateway;
  readonly filesystem: FilesystemGateway;
  readonly storageStatus: StorageStatusGateway;
  readonly widgetFiles: WidgetFileGateway;
}

export function MobileActivityLayer({
  controller,
  dashboard,
  filesystem,
  storageStatus,
  widgetFiles,
}: MobileActivityLayerProps) {
  const activity = controller.currentActivity;
  switch (activity.kind) {
    case MOBILE_ACTIVITY_KIND.HOME:
      return (
        <MobileHome
          entries={controller.desktopEntries}
          error={controller.desktopError}
          gateway={filesystem}
          onOpenDocuments={() =>
            controller.openDirectory(
              FILESYSTEM_ROOT_ID.DOCUMENTS,
              MOBILE_COPY.MY_DOCUMENTS,
            )
          }
          onOpenComputer={controller.openComputer}
          onOpenTrash={controller.openTrash}
          onOpenEntry={controller.openEntry}
          wallpaperUrl={
            controller.preferences.wallpaper
              ? filesystem.contentUrl(controller.preferences.wallpaper.id)
              : null
          }
        />
      );
    case MOBILE_ACTIVITY_KIND.DIRECTORY:
      return (
        <MobileDirectory
          directoryId={activity.directoryId}
          title={activity.title}
          revision={controller.revision}
          menuOpen={controller.menuOpen}
          gateway={filesystem}
          onCloseMenu={controller.closeMenu}
          onRefresh={controller.refresh}
          onOpenDirectory={controller.openDirectory}
          onOpenEntry={controller.openEntry}
        />
      );
    case MOBILE_ACTIVITY_KIND.COMPUTER:
      return (
        <MobileWidgetCatalog
          onCreate={controller.createDraft}
          onOpenStorageStatus={controller.openStorageStatus}
        />
      );
    case MOBILE_ACTIVITY_KIND.TRASH:
      return (
        <MobileRecycleBin
          gateway={filesystem}
          revision={controller.revision}
        />
      );
    case MOBILE_ACTIVITY_KIND.MEDIA: {
      const kind = mediaKindFromContentType(activity.file.contentType);
      return kind ? (
        <MobileMediaViewer
          file={activity.file}
          kind={kind}
          directoryId={activity.directoryId}
          filesystemRevision={controller.revision}
          gateway={filesystem}
          onChangeFile={controller.changeMediaFile}
        />
      ) : null;
    }
    case MOBILE_ACTIVITY_KIND.WIDGET_FILE:
      return (
        <MobileWidgetFileScreen
          entryId={activity.entryId}
          title={activity.title}
          dashboard={dashboard}
          widgetFiles={widgetFiles}
          onDirtyChange={controller.setDirty}
        />
      );
    case MOBILE_ACTIVITY_KIND.WIDGET_DRAFT:
      return controller.draft ? (
        <MobileWidgetDraftScreen
          draft={controller.draft}
          filesystem={filesystem}
          widgetFiles={widgetFiles}
          onSaveDraft={controller.saveDraft}
          onSavedFile={controller.completeDraftFile}
          onDirtyChange={controller.setDirty}
        />
      ) : (
        <MobileWidgetCatalog
          onCreate={controller.createDraft}
          onOpenStorageStatus={controller.replaceWithStorageStatus}
        />
      );
    case MOBILE_ACTIVITY_KIND.STORAGE_STATUS:
      return <MobileStorageStatus gateway={storageStatus} />;
    case MOBILE_ACTIVITY_KIND.WALLPAPER:
      return (
        <MobileWallpaperPicker
          currentWallpaper={controller.preferences.wallpaper}
          loadingPreferences={controller.preferencesLoading}
          saving={controller.preferencesSaving}
          preferenceError={controller.preferencesError}
          filesystem={filesystem}
          onApply={controller.updateWallpaper}
          onApplied={controller.goHome}
          onRetryPreferences={controller.refreshPreferences}
        />
      );
  }
}
