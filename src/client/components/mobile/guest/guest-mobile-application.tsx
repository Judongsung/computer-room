import "@client/styles/mobile.css";
import { useState } from "react";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import { createFileOpener } from "@client/domain/filesystem/text/file-opening";
import { useDownloadConfirmation } from "@client/hooks/filesystem/text/use-download-confirmation";
import { MobileNotepad } from "@client/components/mobile/notepad/mobile-notepad";
import { MobileDownloadConfirmation } from "@client/components/mobile/notepad/download-confirmation";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { MobileHome } from "@client/components/mobile/launcher/mobile-home";
import { GuestMobileDirectory } from "@client/components/mobile/guest/guest-mobile-directory";
import { GuestMobileProgramDocument } from "@client/components/mobile/guest/guest-mobile-program-document";
import { MobileMediaViewer } from "@client/components/mobile/media/mobile-media-viewer";
import { MobileMenu } from "@client/components/mobile/shared/mobile-menu";
import { MobileNavigationBar } from "@client/components/mobile/shared/mobile-navigation-bar";
import { MOBILE_ACTIVITY_KIND } from "@client/constants/mobile/activity";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { MOBILE_LAYOUT_CSS_VARIABLES } from "@client/constants/mobile/layout";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useDesktopEntries } from "@client/hooks/filesystem/use-desktop-entries";
import { useMobileNavigation } from "@client/hooks/shared/use-mobile-navigation";
import { ThumbnailLoadProvider } from "@client/state/filesystem/thumbnail-load-context";
import type { GuestApplicationProps } from "@client/types/guest/guest";
import { downloadFile } from "@client/utils/download-file";

export function GuestMobileApplication(props: GuestApplicationProps) {
  if (!props.session.enabled) {
    return <GuestMobileDisabled {...props} />;
  }
  return (
    <ThumbnailLoadProvider>
      <GuestMobileContent {...props} />
    </ThumbnailLoadProvider>
  );
}

function GuestMobileDisabled({ session }: GuestApplicationProps) {
  return (
    <div className={MOBILE_CLASS_NAME.ROOT} style={MOBILE_LAYOUT_CSS_VARIABLES}>
      <main className={MOBILE_CLASS_NAME.SCREEN}>
        <h1>{GUEST_COPY.DISABLED_TITLE}</h1>
        <p>{GUEST_COPY.DISABLED_DESCRIPTION}</p>
        <a href={session.loginUrl}>{GUEST_COPY.LOGIN}</a>
      </main>
    </div>
  );
}

function GuestMobileContent({ session, gateway }: GuestApplicationProps) {
  const navigation = useMobileNavigation();
  const [revision, setRevision] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const desktop = useDesktopEntries(gateway, revision);
  const downloadConfirmation = useDownloadConfirmation(gateway);
  const activity = navigation.current;

  const openDirectory = (directoryId: string, title: string): void => {
    setMenuOpen(false);
    navigation.push({ kind: MOBILE_ACTIVITY_KIND.DIRECTORY, directoryId, title });
  };
  const openEntry = (entry: FilesystemEntry, directoryId: string): void => {
    setMenuOpen(false);
    if (entry.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      openDirectory(entry.id, entry.name);
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
      media: ({ entry: file }) => navigation.push({ kind: MOBILE_ACTIVITY_KIND.MEDIA, file, directoryId }),
      text: (file) => navigation.push({ kind: MOBILE_ACTIVITY_KIND.TEXT_FILE, file }),
      download: downloadConfirmation.request,
    })(entry);
  };

  let content;
  if (activity.kind === MOBILE_ACTIVITY_KIND.HOME) {
    content = (
      <MobileHome
        entries={desktop.entries}
        error={desktop.error}
        gateway={gateway}
        onOpenDocuments={() =>
          openDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, FILESYSTEM_ROOT_NAME.DOCUMENTS)
        }
        onOpenComputer={() => undefined}
        onOpenTrash={() => undefined}
        onOpenEntry={(entry) => openEntry(entry, FILESYSTEM_ROOT_ID.DESKTOP)}
        wallpaperUrl={null}
        showComputer={false}
        showTrash={false}
      />
    );
  } else if (activity.kind === MOBILE_ACTIVITY_KIND.DIRECTORY) {
    content = (
      <GuestMobileDirectory
        directoryId={activity.directoryId}
        title={activity.title}
        revision={revision}
        gateway={gateway}
        onOpenDirectory={openDirectory}
        onOpenEntry={(entry) => openEntry(entry, activity.directoryId)}
      />
    );
  } else if (activity.kind === MOBILE_ACTIVITY_KIND.TEXT_FILE) {
    content = <MobileNotepad file={activity.file} gateway={gateway} />;
  } else if (activity.kind === MOBILE_ACTIVITY_KIND.MEDIA) {
    const kind = mediaKindFromContentType(activity.file.contentType);
    content = kind ? (
      <MobileMediaViewer
        file={activity.file}
        kind={kind}
        directoryId={activity.directoryId}
        filesystemRevision={revision}
        gateway={gateway}
        onChangeFile={(file) =>
          navigation.replace({ ...activity, file })
        }
      />
    ) : null;
  } else if (activity.kind === MOBILE_ACTIVITY_KIND.WIDGET_FILE) {
    content = (
      <GuestMobileProgramDocument
        entryId={activity.entryId}
        title={activity.title}
        gateway={gateway}
      />
    );
  } else {
    content = null;
  }

  return (
    <div className={MOBILE_CLASS_NAME.ROOT} style={MOBILE_LAYOUT_CSS_VARIABLES}>
      <div className={MOBILE_CLASS_NAME.SCREEN}>{content}</div>
      {downloadConfirmation.file ? <MobileDownloadConfirmation file={downloadConfirmation.file} onConfirm={downloadConfirmation.confirm} onCancel={downloadConfirmation.cancel} /> : null}
      <MobileNavigationBar
        canGoBack={navigation.canGoBack}
        menuEnabled={activity.kind !== MOBILE_ACTIVITY_KIND.TEXT_FILE}
        menuOpen={menuOpen}
        onBack={() => {
          setMenuOpen(false);
          navigation.back();
        }}
        onHome={() => {
          setMenuOpen(false);
          navigation.home();
        }}
        onMenu={() => setMenuOpen((current) => !current)}
      />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
        {activity.kind === MOBILE_ACTIVITY_KIND.HOME ||
        activity.kind === MOBILE_ACTIVITY_KIND.DIRECTORY ? (
          <button
            type="button"
            onClick={() => {
              setRevision((current) => current + 1);
              setMenuOpen(false);
            }}
          >
            {MOBILE_COPY.REFRESH}
          </button>
        ) : null}
        {activity.kind === MOBILE_ACTIVITY_KIND.MEDIA ? (
          <button
            type="button"
            onClick={() => downloadFile(gateway.downloadUrl(activity.file.id))}
          >
            {MOBILE_COPY.DOWNLOAD}
          </button>
        ) : null}
        <a href={session.loginUrl}>{GUEST_COPY.LOGIN}</a>
      </MobileMenu>
    </div>
  );
}
