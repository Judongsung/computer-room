import { useCallback, useEffect, useState } from "react";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import type { SessionInfo } from "@/types/platform/auth";
import type { FilesystemEntry, FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { WidgetFileDocument } from "@/types/widgets/widget-file";
import { MobileHome } from "@client/components/mobile/launcher/mobile-home";
import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import { MobileLazyFeatureBoundary } from "@client/components/mobile/shared/mobile-lazy-feature-boundary";
import { MobileMenu } from "@client/components/mobile/shared/mobile-menu";
import { MobileNavigationBar } from "@client/components/mobile/shared/mobile-navigation-bar";
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
import {
  mobileActivityKey,
  mobileActivityTitle,
} from "@client/components/mobile/shell/mobile-activity-presentation";
import {
  MOBILE_ACTIVITY_KIND,
  MOBILE_ACTIVITY_MENU_AVAILABILITY,
  MOBILE_CLASS_NAME,
  MOBILE_COPY,
  MOBILE_LAYOUT_CSS_VARIABLES,
} from "@client/constants/shared/mobile";
import { useDesktopEntries } from "@client/hooks/filesystem/use-desktop-entries";
import { useMobilePreferences } from "@client/hooks/platform/use-mobile-preferences";
import { useMobileNavigation } from "@client/hooks/shared/use-mobile-navigation";
import { useLocalWidgetDraft } from "@client/hooks/widgets/use-local-widget-draft";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { MobilePreferencesGateway } from "@client/types/platform/mobile-preferences";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";
import { downloadFile } from "@client/utils/download-file";

interface MobileShellProps {
  readonly session: SessionInfo;
  readonly dashboard: DashboardGateway;
  readonly filesystem: FilesystemGateway;
  readonly storageStatus: StorageStatusGateway;
  readonly widgetFiles: WidgetFileGateway;
  readonly mobilePreferences: MobilePreferencesGateway;
}

export function MobileShell({
  session,
  dashboard,
  filesystem,
  storageStatus,
  widgetFiles,
  mobilePreferences: mobilePreferencesGateway,
}: MobileShellProps) {
  const localDraft = useLocalWidgetDraft();
  const mobilePreferences = useMobilePreferences(mobilePreferencesGateway);
  const navigation = useMobileNavigation(
    localDraft.draft
      ? { kind: MOBILE_ACTIVITY_KIND.WIDGET_DRAFT }
      : { kind: MOBILE_ACTIVITY_KIND.HOME },
  );
  const [revision, setRevision] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<FilesystemFileEntry | null>(null);
  const [showDraftConflict, setShowDraftConflict] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const desktop = useDesktopEntries(filesystem, revision);
  const menuEnabled = MOBILE_ACTIVITY_MENU_AVAILABILITY[navigation.current.kind];

  useEffect(() => setMenuOpen(false), [navigation.current]);

  const refresh = useCallback((): void => {
    setRevision((current) => current + 1);
    setMenuOpen(false);
  }, []);

  const openEntry = useCallback(
    (entry: FilesystemEntry): void => {
      if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
        navigation.push({
          kind: MOBILE_ACTIVITY_KIND.DIRECTORY,
          directoryId: entry.id,
          title: entry.name,
        });
        return;
      }
      if (entry.kind === FILESYSTEM_ENTRY_KIND.WIDGET) {
        navigation.push({
          kind: MOBILE_ACTIVITY_KIND.WIDGET_FILE,
          entryId: entry.id,
          title: entry.name,
        });
        return;
      }
      const kind = mediaKindFromContentType(entry.contentType);
      if (kind) {
        navigation.push({
          kind: MOBILE_ACTIVITY_KIND.MEDIA,
          file: entry,
          directoryId: entry.parentId,
        });
      } else {
        setPendingDownload(entry);
      }
    },
    [navigation],
  );

  const createDraft = (
    type: Parameters<typeof localDraft.create>[0],
  ): void => {
    if (localDraft.draft) {
      setShowDraftConflict(true);
      return;
    }
    if (localDraft.create(type)) {
      navigation.push({ kind: MOBILE_ACTIVITY_KIND.WIDGET_DRAFT });
    }
  };

  const canLeave = (): boolean =>
    !hasUnsavedChanges || window.confirm(MOBILE_COPY.UNSAVED_CHANGES);
  const goBack = (): void => {
    if (!canLeave()) return;
    setHasUnsavedChanges(false);
    navigation.back();
  };
  const goHome = (): void => {
    if (!canLeave()) return;
    setHasUnsavedChanges(false);
    navigation.home();
  };
  const openDirectory = (directoryId: string, title: string): void => {
    navigation.push({ kind: MOBILE_ACTIVITY_KIND.DIRECTORY, directoryId, title });
  };
  const savedDraftAsFile = (document: WidgetFileDocument): void => {
    localDraft.remove();
    setRevision((current) => current + 1);
    navigation.replace({
      kind: MOBILE_ACTIVITY_KIND.WIDGET_FILE,
      entryId: document.entry.id,
      title: document.entry.name,
    });
  };

  return (
    <div className={MOBILE_CLASS_NAME.ROOT} style={MOBILE_LAYOUT_CSS_VARIABLES}>
      <div className={MOBILE_CLASS_NAME.SCREEN}>
        <MobileLazyFeatureBoundary
          key={mobileActivityKey(navigation.current)}
          title={mobileActivityTitle(navigation.current)}
        >
          {renderActivity()}
        </MobileLazyFeatureBoundary>
      </div>
      <MobileNavigationBar
        canGoBack={navigation.canGoBack}
        menuEnabled={menuEnabled}
        menuOpen={menuOpen}
        onBack={goBack}
        onHome={goHome}
        onMenu={() => {
          if (menuEnabled) setMenuOpen((current) => !current);
        }}
      />
      <MobileMenu
        open={
          menuOpen &&
          navigation.current.kind !== MOBILE_ACTIVITY_KIND.DIRECTORY
        }
        onClose={() => setMenuOpen(false)}
      >
        {navigation.current.kind === MOBILE_ACTIVITY_KIND.HOME ? (
          <>
            <button type="button" onClick={refresh}>{MOBILE_COPY.REFRESH}</button>
            <button
              type="button"
              onClick={() => {
                navigation.push({ kind: MOBILE_ACTIVITY_KIND.WALLPAPER });
                setMenuOpen(false);
              }}
            >
              {MOBILE_COPY.WALLPAPER}
            </button>
            <a href={session.logoutUrl}>{MOBILE_COPY.LOGOUT}</a>
          </>
        ) : null}
        {navigation.current.kind === MOBILE_ACTIVITY_KIND.TRASH ? (
          <button type="button" onClick={refresh}>{MOBILE_COPY.REFRESH}</button>
        ) : null}
        {navigation.current.kind === MOBILE_ACTIVITY_KIND.MEDIA ? (
          <button
            type="button"
            onClick={() => {
              downloadFile(filesystem.downloadUrl(navigation.current.kind === MOBILE_ACTIVITY_KIND.MEDIA ? navigation.current.file.id : ""));
              setMenuOpen(false);
            }}
          >
            {MOBILE_COPY.DOWNLOAD}
          </button>
        ) : null}
        {navigation.current.kind === MOBILE_ACTIVITY_KIND.WIDGET_DRAFT ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(MOBILE_COPY.DELETE_DRAFT_CONFIRM)) {
                localDraft.remove();
                navigation.home();
                setMenuOpen(false);
              }
            }}
          >
            {MOBILE_COPY.DELETE_DRAFT}
          </button>
        ) : null}
      </MobileMenu>
      {pendingDownload ? (
        <MobileDialog
          title={MOBILE_COPY.DOWNLOAD}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  downloadFile(filesystem.downloadUrl(pendingDownload.id));
                  setPendingDownload(null);
                }}
              >
                {MOBILE_COPY.DOWNLOAD}
              </button>
              <button type="button" onClick={() => setPendingDownload(null)}>{MOBILE_COPY.CANCEL}</button>
            </>
          }
        >
          <p>{MOBILE_COPY.DOWNLOAD_CONFIRM(pendingDownload.name)}</p>
        </MobileDialog>
      ) : null}
      {showDraftConflict ? (
        <MobileDialog
          title={MOBILE_COPY.DRAFT_EXISTS_TITLE}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowDraftConflict(false);
                  navigation.push({ kind: MOBILE_ACTIVITY_KIND.WIDGET_DRAFT });
                }}
              >
                {MOBILE_COPY.RESUME_DRAFT}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(MOBILE_COPY.DELETE_DRAFT_CONFIRM)) {
                    localDraft.remove();
                    setShowDraftConflict(false);
                  }
                }}
              >
                {MOBILE_COPY.DELETE_DRAFT}
              </button>
              <button type="button" onClick={() => setShowDraftConflict(false)}>{MOBILE_COPY.CANCEL}</button>
            </>
          }
        >
          <p>{MOBILE_COPY.DRAFT_EXISTS_MESSAGE}</p>
        </MobileDialog>
      ) : null}
      {localDraft.error ? (
        <MobileDialog
          title={MOBILE_COPY.APP_NAME}
          actions={<button type="button" onClick={localDraft.clearError}>{MOBILE_COPY.CONFIRM}</button>}
        >
          <p>{localDraft.error}</p>
        </MobileDialog>
      ) : null}
    </div>
  );

  function renderActivity() {
    const activity = navigation.current;
    switch (activity.kind) {
      case MOBILE_ACTIVITY_KIND.HOME:
        return (
          <MobileHome
            entries={desktop.entries}
            error={desktop.error}
            gateway={filesystem}
            onOpenDocuments={() => openDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, MOBILE_COPY.MY_DOCUMENTS)}
            onOpenComputer={() => navigation.push({ kind: MOBILE_ACTIVITY_KIND.COMPUTER })}
            onOpenTrash={() => navigation.push({ kind: MOBILE_ACTIVITY_KIND.TRASH })}
            onOpenEntry={openEntry}
            wallpaperUrl={
              mobilePreferences.preferences.wallpaper
                ? filesystem.contentUrl(
                    mobilePreferences.preferences.wallpaper.id,
                  )
                : null
            }
          />
        );
      case MOBILE_ACTIVITY_KIND.DIRECTORY:
        return (
          <MobileDirectory
            directoryId={activity.directoryId}
            title={activity.title}
            revision={revision}
            menuOpen={menuOpen}
            gateway={filesystem}
            onCloseMenu={() => setMenuOpen(false)}
            onRefresh={refresh}
            onOpenDirectory={openDirectory}
            onOpenEntry={openEntry}
          />
        );
      case MOBILE_ACTIVITY_KIND.COMPUTER:
        return (
          <MobileWidgetCatalog
            onCreate={createDraft}
            onOpenStorageStatus={() => navigation.push({ kind: MOBILE_ACTIVITY_KIND.STORAGE_STATUS })}
          />
        );
      case MOBILE_ACTIVITY_KIND.TRASH:
        return <MobileRecycleBin gateway={filesystem} revision={revision} />;
      case MOBILE_ACTIVITY_KIND.MEDIA: {
        const kind = mediaKindFromContentType(activity.file.contentType);
        return kind ? (
          <MobileMediaViewer
            file={activity.file}
            kind={kind}
            directoryId={activity.directoryId}
            filesystemRevision={revision}
            gateway={filesystem}
            onChangeFile={(file) =>
              navigation.replace({
                kind: MOBILE_ACTIVITY_KIND.MEDIA,
                file,
                directoryId: activity.directoryId,
              })
            }
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
            onDirtyChange={setHasUnsavedChanges}
          />
        );
      case MOBILE_ACTIVITY_KIND.WIDGET_DRAFT:
        return localDraft.draft ? (
          <MobileWidgetDraftScreen
            draft={localDraft.draft}
            filesystem={filesystem}
            widgetFiles={widgetFiles}
            onSaveDraft={localDraft.save}
            onSavedFile={savedDraftAsFile}
            onDirtyChange={setHasUnsavedChanges}
          />
        ) : (
          <MobileWidgetCatalog
            onCreate={createDraft}
            onOpenStorageStatus={() => navigation.replace({ kind: MOBILE_ACTIVITY_KIND.STORAGE_STATUS })}
          />
        );
      case MOBILE_ACTIVITY_KIND.STORAGE_STATUS:
        return <MobileStorageStatus gateway={storageStatus} />;
      case MOBILE_ACTIVITY_KIND.WALLPAPER:
        return (
          <MobileWallpaperPicker
            currentWallpaper={mobilePreferences.preferences.wallpaper}
            loadingPreferences={mobilePreferences.loading}
            saving={mobilePreferences.saving}
            preferenceError={mobilePreferences.error}
            filesystem={filesystem}
            onApply={mobilePreferences.updateWallpaper}
            onApplied={navigation.home}
            onRetryPreferences={mobilePreferences.refresh}
          />
        );
    }
  }
}
