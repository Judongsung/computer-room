import { MEDIA_KIND } from "@/constants/filesystem/media";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { MediaKind } from "@/types/filesystem/media";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import { downloadFile } from "@client/utils/download-file";

interface MobileMediaViewerProps {
  readonly file: FilesystemFileEntry;
  readonly kind: MediaKind;
  readonly gateway: FilesystemGateway;
}

export function MobileMediaViewer({ file, kind, gateway }: MobileMediaViewerProps) {
  const source = gateway.contentUrl(file.id);
  const download = (): void => downloadFile(gateway.downloadUrl(file.id));
  return (
    <MobileActivity title={file.name}>
      <div className={MOBILE_CLASS_NAME.MEDIA}>
        {kind === MEDIA_KIND.IMAGE ? (
          <img src={source} alt={file.name} />
        ) : (
          <video src={source} controls playsInline preload="metadata" />
        )}
        <div className={MOBILE_CLASS_NAME.MEDIA_ACTIONS}>
          <button type="button" onClick={download}>{MOBILE_COPY.DOWNLOAD}</button>
        </div>
      </div>
    </MobileActivity>
  );
}
