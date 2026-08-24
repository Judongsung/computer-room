import { useEffect, useState } from "react";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import {
  DESKTOP_ENTRY_UNORDERED_INDEX,
  FILESYSTEM_COPY,
} from "@client/constants/filesystem/filesystem";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

export function useDesktopEntries(
  gateway: FilesystemGateway,
  revision: number,
) {
  const [entries, setEntries] = useState<readonly FilesystemEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listAllDesktopEntries(gateway)
      .then((items) => {
        if (!active) return;
        setEntries(items);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error && reason.message
            ? reason.message
            : FILESYSTEM_COPY.LOAD_FAILED,
        );
      });
    return () => {
      active = false;
    };
  }, [gateway, revision]);

  return { entries, error };
}

async function listAllDesktopEntries(
  gateway: FilesystemGateway,
): Promise<FilesystemEntry[]> {
  const items: FilesystemEntry[] = [];
  let offset = 0;
  while (true) {
    const page = await gateway.listDirectory(FILESYSTEM_ROOT_ID.DESKTOP, offset);
    items.push(...page.items);
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
