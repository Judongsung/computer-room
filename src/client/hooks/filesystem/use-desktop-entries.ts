import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useLayoutEffect, useState } from "react";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { DESKTOP_ENTRY_UNORDERED_INDEX } from "@client/constants/filesystem/filesystem";
import { messageFromError } from "@client/errors/error-message";
import { mergeFilesystemItems } from "@client/hooks/filesystem/use-filesystem-pages";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";

export function useDesktopEntries(
  gateway: Pick<FilesystemDirectoryGateway, "listDirectory">,
  revision: number,
) {
  const [state, setState] = useState({
    gateway,
    entries: [] as readonly FilesystemEntry[],
    error: null as string | null,
  });

  useLayoutEffect(() => {
    let active = true;
    setState((current) => current.gateway === gateway
      ? current
      : { gateway, entries: [], error: null });
    void listAllDesktopEntries(gateway, () => active)
      .then((items) => {
        if (!active || items === null) return;
        setState({ gateway, entries: items, error: null });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setState((current) => ({
          gateway,
          entries: current.gateway === gateway ? current.entries : [],
          error: messageFromError(reason, FILESYSTEM_COPY.LOAD_FAILED),
        }));
      });
    return () => {
      active = false;
    };
  }, [gateway, revision]);

  return state.gateway === gateway
    ? { entries: state.entries, error: state.error }
    : { entries: [] as readonly FilesystemEntry[], error: null };
}

async function listAllDesktopEntries(
  gateway: Pick<FilesystemDirectoryGateway, "listDirectory">,
  isCurrent: () => boolean,
): Promise<FilesystemEntry[] | null> {
  let items: FilesystemEntry[] = [];
  let offset = 0;
  while (true) {
    const page = await gateway.listDirectory(FILESYSTEM_ROOT_ID.DESKTOP, offset);
    if (!isCurrent()) return null;
    items = mergeFilesystemItems(items, page.items, (item) => item.id);
    if (page.nextOffset === null) return items.sort(compareDesktopEntries);
    offset = page.nextOffset;
  }
}

function compareDesktopEntries(
  left: FilesystemEntry,
  right: FilesystemEntry,
): number {
  return (
    (left.desktopOrder ?? DESKTOP_ENTRY_UNORDERED_INDEX) -
      (right.desktopOrder ?? DESKTOP_ENTRY_UNORDERED_INDEX) ||
    left.id.localeCompare(right.id)
  );
}
