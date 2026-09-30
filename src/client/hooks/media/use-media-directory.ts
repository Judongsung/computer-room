import { MEDIA_VIEWER_COPY } from "@client/content/ko/media/media";
import { useLayoutEffect, useMemo, useState } from "react";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { mediaKindFromContentType } from "@/domain/filesystem/media-type";
import type { FilesystemEntry, FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { MediaKind } from "@/types/filesystem/media";
import { MEDIA_NAVIGATION_INITIAL_OFFSET } from "@client/constants/media/media";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";
import { messageFromError } from "@client/errors/error-message";
import { mergeFilesystemItems } from "@client/hooks/filesystem/use-filesystem-pages";

export function useMediaDirectory(
  gateway: Pick<FilesystemDirectoryGateway, "listDirectory">,
  directoryId: string,
  filesystemRevision: number,
  mediaKind?: MediaKind,
) {
  const target = useMemo(
    () => ({ gateway, directoryId, mediaKind }),
    [gateway, directoryId, mediaKind],
  );
  const initial = {
    entries: [] as readonly FilesystemFileEntry[],
    error: null as string | null,
    isLoading: true,
  };
  const [state, setState] = useState({ target, ...initial });

  useLayoutEffect(() => {
    let active = true;
    setState((current) => ({
      target,
      entries: current.target === target ? current.entries : [],
      error: null,
      isLoading: true,
    }));
    void loadAllMedia(
      target.gateway, target.directoryId, () => active, target.mediaKind,
    )
      .then((items) => {
        if (!active || items === null) return;
        setState({ target, entries: items, error: null, isLoading: false });
      })
      .catch((reason: unknown) => {
        if (active) {
          setState((current) => ({
            target,
            entries: current.target === target ? current.entries : [],
            error: messageFromError(reason, MEDIA_VIEWER_COPY.NAVIGATION_FAILED),
            isLoading: false,
          }));
        }
      });
    return () => {
      active = false;
    };
  }, [filesystemRevision, target]);

  return state.target === target
    ? { entries: state.entries, error: state.error, isLoading: state.isLoading }
    : initial;
}

async function loadAllMedia(
  gateway: Pick<FilesystemDirectoryGateway, "listDirectory">,
  directoryId: string,
  isCurrent: () => boolean,
  mediaKind?: MediaKind,
): Promise<readonly FilesystemFileEntry[] | null> {
  let entries: FilesystemEntry[] = [];
  let offset = MEDIA_NAVIGATION_INITIAL_OFFSET;
  while (true) {
    const page = await gateway.listDirectory(directoryId, offset);
    if (!isCurrent()) return null;
    entries = mergeFilesystemItems(entries, page.items, (entry) => entry.id);
    if (page.nextOffset === null) {
      return entries.filter(
        (entry): entry is FilesystemFileEntry => {
          if (entry.kind !== FILESYSTEM_ENTRY_KIND.FILE) return false;
          const entryMediaKind = mediaKindFromContentType(entry.contentType);
          return (
            entryMediaKind !== null &&
            (mediaKind === undefined || entryMediaKind === mediaKind)
          );
        },
      );
    }
    offset = page.nextOffset;
  }
}
