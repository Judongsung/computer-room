import { useEffect, useState } from "react";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import {
  MEDIA_NAVIGATION_INITIAL_OFFSET,
  MEDIA_VIEWER_COPY,
} from "@client/constants/media/media";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

export function useMediaDirectory(
  gateway: FilesystemGateway,
  directoryId: string,
  filesystemRevision: number,
) {
  const [entries, setEntries] = useState<readonly FilesystemFileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void loadAllMedia(gateway, directoryId)
      .then((items) => {
        if (active) setEntries(items);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error && reason.message
              ? reason.message
              : MEDIA_VIEWER_COPY.NAVIGATION_FAILED,
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [directoryId, filesystemRevision, gateway]);

  return { entries, error, isLoading };
}

async function loadAllMedia(
  gateway: FilesystemGateway,
  directoryId: string,
): Promise<readonly FilesystemFileEntry[]> {
  const entries: FilesystemFileEntry[] = [];
  let offset = MEDIA_NAVIGATION_INITIAL_OFFSET;
  while (true) {
    const page = await gateway.listDirectory(directoryId, offset);
    entries.push(
      ...page.items.filter(
        (entry): entry is FilesystemFileEntry =>
          entry.kind === FILESYSTEM_ENTRY_KIND.FILE &&
          mediaKindFromContentType(entry.contentType) !== null,
      ),
    );
    if (page.nextOffset === null) {
      return entries;
    }
    offset = page.nextOffset;
  }
}
