import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalizeFilesystemName } from "@/domain/filesystem/filesystem-name";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import { useFilesystemMutation } from "@client/hooks/filesystem/commands/use-filesystem-mutation";
import { useFilesystemSelection } from "@client/hooks/filesystem/use-filesystem-selection";
import { useUnsavedChangesWarning } from "@client/hooks/shared/use-unsaved-changes-warning";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

export type MobileFileDialog = "create" | "rename" | "move" | "trash" | "delete" | "empty" | null;
export type MobileNavigationGuard = (() => boolean) | null;

interface MobileFileActionsOptions {
  readonly gateway: FilesystemGateway;
  readonly location: string;
  readonly entries: readonly FilesystemEntry[];
  readonly onChanged: () => void;
  readonly onGuardChange: (guard: MobileNavigationGuard) => void;
}

export function useMobileFileActions({
  gateway, location, entries, onChanged, onGuardChange,
}: MobileFileActionsOptions) {
  const scope = useMemo(() => ({ gateway, location }), [gateway, location]);
  const mutation = useFilesystemMutation(scope);
  const ids = useMemo(() => entries.map((entry) => entry.id), [entries]);
  const selection = useFilesystemSelection(ids);
  const [selecting, setSelecting] = useState(false);
  const [dialog, setDialog] = useState<MobileFileDialog>(null);
  const [batch, setBatch] = useState<FilesystemBatchResult | null>(null);
  const latestChanged = useRef(onChanged);
  const dialogGuard = useRef<MobileNavigationGuard>(null);
  const setDialogGuard = useCallback((guard: MobileNavigationGuard) => {
    dialogGuard.current = guard;
  }, []);
  useLayoutEffect(() => {
    latestChanged.current = onChanged;
  }, [onChanged]);
  const { clear, replace } = selection;
  useLayoutEffect(() => {
    clear();
    setSelecting(false);
    setDialog(null);
    setBatch(null);
  }, [scope, clear]);
  useUnsavedChangesWarning(mutation.busy);

  const cancelSelection = useCallback(() => {
    clear();
    setSelecting(false);
  }, [clear]);
  useLayoutEffect(() => {
    onGuardChange(() => {
      if (mutation.busy) return false;
      if (dialogGuard.current?.() === false) return false;
      if (dialog) {
        setDialog(null);
        return false;
      }
      if (batch) {
        setBatch(null);
        return false;
      }
      if (selecting) {
        cancelSelection();
        return false;
      }
      return true;
    });
    return () => onGuardChange(null);
  }, [mutation.busy, dialog, batch, selecting, cancelSelection, onGuardChange]);

  const selected = entries.filter((entry) => selection.selectedIds.has(entry.id));
  const runBatch = async (
    operation: () => Promise<FilesystemBatchResult>,
    refreshOnFailure = false,
  ): Promise<void> => {
    const outcome = await mutation.run(operation, (result) => {
      setDialog(null);
      setBatch(result.failures.length ? result : null);
      replace(result.failures.map((failure) => failure.id));
      setSelecting(result.failures.length > 0);
      latestChanged.current();
    });
    if (refreshOnFailure && outcome.status === "failed") latestChanged.current();
  };
  const saveName = (value: string) => mutation.run(async () => {
    const name = normalizeFilesystemName(value);
    if (dialog === "create") return gateway.createDirectory(location, name);
    const entry = selected[0];
    if (!entry) return;
    return gateway.updateEntry(entry.id, { name });
  }, () => {
    setDialog(null);
    cancelSelection();
    latestChanged.current();
  });
  const confirm = async (): Promise<void> => {
    const selectedIds = selection.selectedInOrder;
    if (dialog === "trash") await runBatch(() => gateway.trashEntries(selectedIds));
    if (dialog === "delete") await runBatch(() => gateway.permanentlyDeleteEntries(selectedIds), true);
    if (dialog === "empty") {
      const outcome = await mutation.run(() => gateway.emptyTrash(), () => {
        setDialog(null);
        cancelSelection();
      });
      if (outcome.status !== "ignored") latestChanged.current();
    }
  };
  return {
    selecting,
    selection,
    selected,
    dialog,
    batch,
    mutation,
    setDialogGuard,
    loadedCount: entries.length,
    startSelection: () => setSelecting(true),
    cancelSelection,
    openDialog: (value: MobileFileDialog) => {
      mutation.clearError();
      setDialog(value);
    },
    closeDialog: () => {
      if (!mutation.busy) setDialog(null);
    },
    closeBatch: () => setBatch(null),
    saveName,
    confirm,
    move: (parentId: string) => runBatch(() => gateway.moveEntries(selection.selectedInOrder, { parentId })),
    restore: () => runBatch(() => gateway.restoreEntries(selection.selectedInOrder)),
  };
}
