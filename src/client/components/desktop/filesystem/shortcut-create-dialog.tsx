import { useState } from "react";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { MAX_FILE_NAME_BYTES } from "@/constants/filesystem/file";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import { DirectoryPickerDialog } from "@client/components/filesystem/filesystem-dialogs";
import { SHORTCUT_COPY } from "@client/content/ko/filesystem/shortcut";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useFilesystemMutation } from "@client/hooks/filesystem/commands/use-filesystem-mutation";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

interface ShortcutCreateDialogProps {
  readonly gateway: FilesystemGateway;
  readonly entry: FilesystemEntry;
  readonly desktopCapacity: number;
  readonly onCreated: () => void;
  readonly onCancel: () => void;
}

export function ShortcutCreateDialog({ gateway, entry, desktopCapacity, onCreated, onCancel }: ShortcutCreateDialogProps) {
  const [name, setName] = useState(() => defaultName(entry.name));
  const mutation = useFilesystemMutation(gateway);
  return <DirectoryPickerDialog
    gateway={gateway}
    title={SHORTCUT_COPY.CREATE}
    selectLabel={SHORTCUT_COPY.CREATE_HERE}
    initialDirectoryId={FILESYSTEM_ROOT_ID.DESKTOP}
    busy={mutation.busy}
    selectDisabled={!name.trim()}
    extraContent={<>
      <label>{FILESYSTEM_COPY.ENTRY_NAME}<input value={name} disabled={mutation.busy} onChange={(event) => setName(event.target.value)} /></label>
      {mutation.error ? <p role="alert">{mutation.error}</p> : null}
    </>}
    onSelect={(parentId) => void mutation.run(() => gateway.createShortcut({
      targetEntryId: entry.id, parentId, name,
      ...(parentId === FILESYSTEM_ROOT_ID.DESKTOP ? { desktopPlacement: { targetIndex: 0, capacity: desktopCapacity } } : {}),
    }), onCreated)}
    onCancel={onCancel}
  />;
}

function defaultName(original: string): string {
  const characters = Array.from(original);
  const encoder = new TextEncoder();
  while (encoder.encode(characters.join("") + SHORTCUT_COPY.SUFFIX).length > MAX_FILE_NAME_BYTES) characters.pop();
  return characters.join("") + SHORTCUT_COPY.SUFFIX;
}
