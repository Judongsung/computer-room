import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFilesystemUpload } from "@client/hooks/filesystem/use-filesystem-upload";
import { useUnsavedChangesWarning } from "@client/hooks/shared/use-unsaved-changes-warning";
import { collectSelectedUploadNodes } from "@client/domain/filesystem/local-file-tree";
import type { MobileNavigationGuard } from "@client/hooks/mobile/filesystem/use-mobile-file-actions";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { createFileOpener } from "@client/domain/filesystem/text/file-opening";
import type { FilesystemEntry, FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { WidgetFileDocument, WidgetFileType } from "@/types/widgets/widget-file";
import {
  MOBILE_ACTIVITY_KIND,
  MOBILE_ACTIVITY_MENU_AVAILABILITY,
} from "@client/constants/mobile/activity";
import { useDesktopEntries } from "@client/hooks/filesystem/use-desktop-entries";
import { useMobilePreferences } from "@client/hooks/platform/use-mobile-preferences";
import { useMobileNavigation } from "@client/hooks/shared/use-mobile-navigation";
import { useLocalWidgetDraft } from "@client/hooks/widgets/use-local-widget-draft";
import type { MobileShellController } from "@client/types/app/mobile-shell";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { MobilePreferencesGateway } from "@client/types/platform/mobile-preferences";
import type { LocalWidgetDraft } from "@client/types/widgets/local-widget-draft";
import { downloadFile } from "@client/utils/download-file";

interface UseMobileShellControllerOptions {
  readonly filesystem: FilesystemGateway;
  readonly mobilePreferences: MobilePreferencesGateway;
}

export function useMobileShellController({
  filesystem,
  mobilePreferences: mobilePreferencesGateway,
}: UseMobileShellControllerOptions): MobileShellController {
  const localDraft = useLocalWidgetDraft();
  const mobilePreferences = useMobilePreferences(mobilePreferencesGateway);
  const { refresh: refreshPreferences } = mobilePreferences;
  const [revision, setRevision] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const refresh = useCallback((): void => {
    setRevision((current) => current + 1);
    setMenuOpen(false);
  }, []);
  const transfer = useFilesystemUpload(filesystem, refresh);
  useUnsavedChangesWarning(transfer.state.isOpen);
  const fileGuard = useRef<MobileNavigationGuard>(null);
  const setFileNavigationGuard = useCallback((guard: MobileNavigationGuard) => {
    fileGuard.current = guard;
  }, []);
  const navigation = useMobileNavigation(
    localDraft.draft
      ? { kind: MOBILE_ACTIVITY_KIND.WIDGET_DRAFT }
      : { kind: MOBILE_ACTIVITY_KIND.HOME },
    () => !transfer.state.isOpen && (fileGuard.current?.() ?? true),
  );
  const [pendingDownload, setPendingDownload] =
    useState<FilesystemFileEntry | null>(null);
  const [draftConflictOpen, setDraftConflictOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const desktop = useDesktopEntries(filesystem, revision);
  const menuEnabled =
    MOBILE_ACTIVITY_MENU_AVAILABILITY[navigation.current.kind];

  const currentActivity = navigation.current;
  useEffect(() => setMenuOpen(false), [currentActivity]);

  const filesChanged = useCallback(() => {
    refresh();
    void refreshPreferences();
  }, [refresh, refreshPreferences]);

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
      createFileOpener({
        media: ({ entry: file, directoryId }) => navigation.push({ kind: MOBILE_ACTIVITY_KIND.MEDIA, file, directoryId }),
        text: (file) => navigation.push({ kind: MOBILE_ACTIVITY_KIND.TEXT_FILE, file }),
        download: setPendingDownload,
      })(entry);
    },
    [navigation],
  );

  const createDraft = useCallback(
    (type: WidgetFileType): void => {
      if (localDraft.draft) {
        setDraftConflictOpen(true);
        return;
      }
      if (localDraft.create(type)) {
        navigation.push({ kind: MOBILE_ACTIVITY_KIND.WIDGET_DRAFT });
      }
    },
    [localDraft, navigation],
  );

  const canLeave = useCallback(
    (): boolean =>
      !hasUnsavedChanges || window.confirm(MOBILE_COPY.UNSAVED_CHANGES),
    [hasUnsavedChanges],
  );
  const goBack = useCallback((): void => {
    if (!canLeave()) return;
    setHasUnsavedChanges(false);
    navigation.back();
  }, [canLeave, navigation]);
  const goHome = useCallback((): void => {
    if (!canLeave()) return;
    setHasUnsavedChanges(false);
    navigation.home();
  }, [canLeave, navigation]);

  const openDirectory = useCallback(
    (directoryId: string, title: string): void => {
      navigation.push({
        kind: MOBILE_ACTIVITY_KIND.DIRECTORY,
        directoryId,
        title,
      });
    },
    [navigation],
  );

  const completeDraftFile = useCallback(
    (document: WidgetFileDocument): void => {
      localDraft.remove();
      setRevision((current) => current + 1);
      navigation.replace({
        kind: MOBILE_ACTIVITY_KIND.WIDGET_FILE,
        entryId: document.entry.id,
        title: document.entry.name,
      });
    },
    [localDraft, navigation],
  );

  const changeMediaFile = useCallback(
    (file: FilesystemFileEntry): void => {
      if (navigation.current.kind !== MOBILE_ACTIVITY_KIND.MEDIA) return;
      navigation.replace({
        kind: MOBILE_ACTIVITY_KIND.MEDIA,
        file,
        directoryId: navigation.current.directoryId,
      });
    },
    [navigation],
  );

  const downloadCurrentMedia = useCallback((): void => {
    if (currentActivity.kind !== MOBILE_ACTIVITY_KIND.MEDIA) return;
    downloadFile(filesystem.downloadUrl(currentActivity.file.id));
    setMenuOpen(false);
  }, [filesystem, currentActivity]);

  const discardCurrentDraft = useCallback((): void => {
    if (!window.confirm(MOBILE_COPY.DELETE_DRAFT_CONFIRM)) return;
    localDraft.remove();
    navigation.home();
    setMenuOpen(false);
  }, [localDraft, navigation]);

  const confirmPendingDownload = useCallback((): void => {
    if (!pendingDownload) return;
    downloadFile(filesystem.downloadUrl(pendingDownload.id));
    setPendingDownload(null);
  }, [filesystem, pendingDownload]);

  return {
    currentActivity: navigation.current,
    canGoBack: navigation.canGoBack,
    menuEnabled: menuEnabled && !transfer.state.isOpen,
    menuOpen,
    revision,
    desktopEntries: desktop.entries,
    desktopError: desktop.error,
    draft: localDraft.draft,
    draftError: localDraft.error,
    preferences: mobilePreferences.preferences,
    preferencesLoading: mobilePreferences.loading,
    preferencesSaving: mobilePreferences.saving,
    preferencesError: mobilePreferences.error,
    pendingDownload,
    draftConflictOpen,
    refresh,
    filesChanged,
    transfer,
    setFileNavigationGuard,
    uploadFiles: (files, directoryId) => {
      setMenuOpen(false);
      void transfer.upload(collectSelectedUploadNodes(files), directoryId);
    },
    closeMenu: () => setMenuOpen(false),
    toggleMenu: () => {
      if (menuEnabled && !transfer.state.isOpen) setMenuOpen((current) => !current);
    },
    goBack,
    goHome,
    openDirectory,
    openSearch: (directory) => {
      setMenuOpen(false);
      navigation.push({ kind: MOBILE_ACTIVITY_KIND.SEARCH, location: { directory } });
    },
    rememberSearch: (query) => {
      if (currentActivity.kind === MOBILE_ACTIVITY_KIND.SEARCH) {
        navigation.replace({
          ...currentActivity,
          location: { ...currentActivity.location, initialQuery: query },
        });
      }
    },
    openComputer: () =>
      navigation.push({ kind: MOBILE_ACTIVITY_KIND.COMPUTER }),
    openTrash: () => navigation.push({ kind: MOBILE_ACTIVITY_KIND.TRASH }),
    openWallpaper: () => {
      navigation.push({ kind: MOBILE_ACTIVITY_KIND.WALLPAPER });
      setMenuOpen(false);
    },
    openStorageStatus: () =>
      navigation.push({ kind: MOBILE_ACTIVITY_KIND.STORAGE_STATUS }),
    replaceWithStorageStatus: () =>
      navigation.replace({ kind: MOBILE_ACTIVITY_KIND.STORAGE_STATUS }),
    openEntry,
    changeMediaFile,
    downloadCurrentMedia,
    createDraft,
    saveDraft: (draft: LocalWidgetDraft) => localDraft.save(draft),
    completeDraftFile,
    discardCurrentDraft,
    resumeDraftConflict: () => {
      setDraftConflictOpen(false);
      navigation.push({ kind: MOBILE_ACTIVITY_KIND.WIDGET_DRAFT });
    },
    discardConflictingDraft: () => {
      if (!window.confirm(MOBILE_COPY.DELETE_DRAFT_CONFIRM)) return;
      localDraft.remove();
      setDraftConflictOpen(false);
    },
    dismissDraftConflict: () => setDraftConflictOpen(false),
    clearDraftError: localDraft.clearError,
    setDirty: setHasUnsavedChanges,
    confirmPendingDownload,
    cancelPendingDownload: () => setPendingDownload(null),
    updateWallpaper: mobilePreferences.updateWallpaper,
    refreshPreferences: mobilePreferences.refresh,
  };
}
