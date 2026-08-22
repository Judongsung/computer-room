import { useEffect, useState } from "react";
import { FILESYSTEM_ROOT_ID } from "../../constants/filesystem";
import type { FilesystemEntry } from "../../types/filesystem";
import { FILESYSTEM_COPY } from "../constants/filesystem";
import type { FilesystemGateway } from "../types/filesystem";

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
    if (page.nextOffset === null) return items;
    offset = page.nextOffset;
  }
}
