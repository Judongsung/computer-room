import { MEDIA_KIND } from "@/constants/filesystem/media";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { MediaKind } from "@/types/filesystem/media";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import { useHorizontalImageSwipe } from "@client/hooks/media/use-horizontal-image-swipe";
import { useMediaDirectory } from "@client/hooks/media/use-media-directory";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";
import type { FilesystemContentGateway } from "@client/types/filesystem/ports/transfer";
import { downloadFile } from "@client/utils/download-file";

interface MobileMediaViewerProps {
  readonly file: FilesystemFileEntry;
  readonly kind: MediaKind;
  readonly directoryId: string;
  readonly filesystemRevision: number;
  readonly gateway: Pick<FilesystemDirectoryGateway, "listDirectory"> &
    Pick<FilesystemContentGateway, "downloadUrl" | "contentUrl">;
  readonly onChangeFile: (file: FilesystemFileEntry) => void;
}

export function MobileMediaViewer({
  file,
  kind,
  directoryId,
  filesystemRevision,
  gateway,
  onChangeFile,
}: MobileMediaViewerProps) {
  if (kind === MEDIA_KIND.IMAGE) {
    return (
      <MobileImageViewer
        file={file}
        directoryId={directoryId}
        filesystemRevision={filesystemRevision}
        gateway={gateway}
        onChangeFile={onChangeFile}
      />
    );
  }

  const download = (): void => downloadFile(gateway.downloadUrl(file.id));
  return (
    <MobileActivity title={file.name}>
      <div className={MOBILE_CLASS_NAME.MEDIA}>
        <video
          src={gateway.contentUrl(file.id)}
          controls
          playsInline
          preload="metadata"
        />
        <div className={MOBILE_CLASS_NAME.MEDIA_ACTIONS}>
          <button type="button" onClick={download}>{MOBILE_COPY.DOWNLOAD}</button>
        </div>
      </div>
    </MobileActivity>
  );
}

function MobileImageViewer({
  file,
  directoryId,
  filesystemRevision,
  gateway,
  onChangeFile,
}: Omit<MobileMediaViewerProps, "kind">) {
  const directory = useMediaDirectory(
    gateway,
    directoryId,
    filesystemRevision,
    MEDIA_KIND.IMAGE,
  );
  const currentIndex = directory.entries.findIndex(
    (entry) => entry.id === file.id,
  );
  const navigate = (offset: number): void => {
    const next = directory.entries[currentIndex + offset];
    if (next) onChangeFile(next);
  };
  const swipe = useHorizontalImageSwipe({
    enabled: !directory.isLoading && currentIndex >= 0,
    onPrevious: () => navigate(-1),
    onNext: () => navigate(1),
  });
  const download = (): void => downloadFile(gateway.downloadUrl(file.id));

  return (
    <MobileActivity title={file.name}>
      <div className={MOBILE_CLASS_NAME.MEDIA}>
        <div className={MOBILE_CLASS_NAME.MEDIA_VIEWPORT} {...swipe}>
          <img
            key={file.id}
            src={gateway.contentUrl(file.id)}
            alt={file.name}
            draggable={false}
          />
          {directory.error ? (
            <p
              className={MOBILE_CLASS_NAME.MEDIA_NAVIGATION_ERROR}
              role="alert"
            >
              {directory.error}
            </p>
          ) : null}
          {directory.isLoading ? (
            <span className="visually-hidden">{MOBILE_COPY.LOADING}</span>
          ) : null}
        </div>
        <div className={MOBILE_CLASS_NAME.MEDIA_ACTIONS}>
          <button type="button" onClick={download}>{MOBILE_COPY.DOWNLOAD}</button>
        </div>
      </div>
    </MobileActivity>
  );
}
