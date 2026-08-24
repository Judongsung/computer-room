import { useCallback, useMemo, useState, type RefObject } from "react";
import { desktopIconLayout } from "@client/domain/desktop/desktop-icon-layout";
import { useDesktopEntries } from "@client/hooks/filesystem/use-desktop-entries";
import { useFilesystemDownload } from "@client/hooks/filesystem/use-filesystem-download";
import { useFilesystemMarqueeSelection } from "@client/hooks/filesystem/use-filesystem-marquee-selection";
import { useFilesystemSelection } from "@client/hooks/filesystem/use-filesystem-selection";
import { useFilesystemUpload } from "@client/hooks/filesystem/use-filesystem-upload";
import type { DesktopDimensions } from "@client/types/desktop/desktop";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

export function useDesktopFilesystemController(
  gateway: FilesystemGateway,
  workAreaRef: RefObject<HTMLElement | null>,
  desktop: DesktopDimensions,
) {
  const [revision, setRevision] = useState(0);
  const notifyChanged = useCallback(() => setRevision((current) => current + 1), []);
  const entries = useDesktopEntries(gateway, revision);
  const iconLayout = useMemo(() => desktopIconLayout(desktop), [desktop]);
  const visibleEntries = useMemo(
    () => entries.entries.slice(0, iconLayout.dynamicCapacity),
    [entries.entries, iconLayout.dynamicCapacity],
  );
  const visibleEntryIds = useMemo(
    () => visibleEntries.map((entry) => entry.id),
    [visibleEntries],
  );
  const selection = useFilesystemSelection(visibleEntryIds);
  const marquee = useFilesystemMarqueeSelection(
    workAreaRef,
    selection.selectedIds,
    selection.replace,
  );
  const selectedEntries = useMemo(
    () => visibleEntries.filter((entry) => selection.selectedIds.has(entry.id)),
    [selection.selectedIds, visibleEntries],
  );
  const upload = useFilesystemUpload(gateway, notifyChanged);
  const download = useFilesystemDownload(gateway);
  const overflowCount = Math.max(0, entries.entries.length - visibleEntries.length);

  return {
    revision,
    notifyChanged,
    entries,
    iconLayout,
    visibleEntries,
    selection,
    marquee,
    selectedEntries,
    upload,
    download,
    overflowCount,
  } as const;
}
