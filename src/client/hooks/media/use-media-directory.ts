import { useEffect, useState } from "react";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { MediaKind } from "@/types/filesystem/media";
import {
  MEDIA_NAVIGATION_INITIAL_OFFSET,
  MEDIA_VIEWER_COPY,
} from "@client/constants/media/media";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";
import { messageFromError } from "@client/errors/error-message";

export function useMediaDirectory(
  gateway: Pick<FilesystemDirectoryGateway, "listDirectory">,
  directoryId: string,
  filesystemRevision: number,
  mediaKind?: MediaKind,
) {
  const [entries, setEntries] = useState<readonly FilesystemFileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void loadAllMedia(gateway, directoryId, mediaKind)
      .then((items) => {
        if (active) setEntries(items);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            messageFromError(reason, MEDIA_VIEWER_COPY.NAVIGATION_FAILED),
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [directoryId, filesystemRevision, gateway, mediaKind]);

  return { entries, error, isLoading };
}

async function loadAllMedia(
  gateway: Pick<FilesystemDirectoryGateway, "listDirectory">,
  directoryId: string,
  mediaKind?: MediaKind,
): Promise<readonly FilesystemFileEntry[]> {
  const entries: FilesystemFileEntry[] = [];
  let offset = MEDIA_NAVIGATION_INITIAL_OFFSET;
  while (true) {
    const page = await gateway.listDirectory(directoryId, offset);
    entries.push(
      ...page.items.filter(
        (entry): entry is FilesystemFileEntry => {
          if (entry.kind !== FILESYSTEM_ENTRY_KIND.FILE) return false;
          const entryMediaKind = mediaKindFromContentType(entry.contentType);
          return (
            entryMediaKind !== null &&
            (mediaKind === undefined || entryMediaKind === mediaKind)
          );
        },
      ),
    );
    if (page.nextOffset === null) {
      return entries;
    }
    offset = page.nextOffset;
  }
}
