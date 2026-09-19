import { useState } from "react";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { MOBILE_FILESYSTEM_COPY } from "@client/content/ko/mobile/filesystem";
import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import { MobileDirectoryPicker } from "@client/components/mobile/filesystem/manage/mobile-directory-picker";
import type { useMobileFileActions } from "@client/hooks/mobile/filesystem/use-mobile-file-actions";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

interface MobileFileDialogsProps {
  readonly actions: ReturnType<typeof useMobileFileActions>;
  readonly gateway: FilesystemGateway;
  readonly location: string;
}

export function MobileFileDialogs({ actions, gateway, location }: MobileFileDialogsProps) {
  const { dialog, mutation, batch } = actions;
  if (dialog === "move") {
    return (
      <MobileDirectoryPicker
        gateway={gateway}
        sourceId={location}
        excludedIds={actions.selection.selectedInOrder}
        busy={mutation.busy}
        error={mutation.error}
        onSelect={(id) => void actions.move(id)}
        onClose={actions.closeDialog}
      />
    );
  }
  if (dialog === "create" || dialog === "rename") {
    return (
      <MobileNameDialog
        key={dialog}
        title={dialog === "create" ? FILESYSTEM_COPY.CREATE_FOLDER_TITLE : FILESYSTEM_COPY.RENAME_TITLE}
        initialValue={dialog === "rename" ? actions.selected[0]?.name ?? "" : ""}
        busy={mutation.busy}
        error={mutation.error}
        onSubmit={(name) => void actions.saveName(name)}
        onClose={actions.closeDialog}
      />
    );
  }
  if (dialog) {
    const title = dialog === "trash" ? FILESYSTEM_COPY.DELETE
      : dialog === "delete" ? FILESYSTEM_COPY.PERMANENT_DELETE : FILESYSTEM_COPY.EMPTY_RECYCLE_BIN;
    const message = dialog === "trash" ? MOBILE_FILESYSTEM_COPY.TRASH_CONFIRM(actions.selected.length)
      : dialog === "delete" ? MOBILE_FILESYSTEM_COPY.DELETE_CONFIRM(actions.selected.length) : MOBILE_FILESYSTEM_COPY.EMPTY_CONFIRM;
    return (
      <MobileDialog title={title} actions={
        <>
          <button type="button" disabled={mutation.busy} onClick={() => void actions.confirm()}>
            {FILESYSTEM_COPY.CONFIRM}
          </button>
          <button type="button" disabled={mutation.busy} onClick={actions.closeDialog}>
            {FILESYSTEM_COPY.CANCEL}
          </button>
        </>
      }>
        <p>{message}</p>
        {dialog === "empty" ? <p>{MOBILE_FILESYSTEM_COPY.LOADED_COUNT(actions.loadedCount)}</p> : null}
        {mutation.error ? <p role="alert">{mutation.error}</p> : null}
      </MobileDialog>
    );
  }
  if (batch) {
    return (
      <MobileDialog title={FILESYSTEM_COPY.BATCH_RESULT_TITLE}
        actions={<button type="button" onClick={actions.closeBatch}>{FILESYSTEM_COPY.CLOSE}</button>}
      >
        <p>{FILESYSTEM_COPY.BATCH_SUCCESS_COUNT(batch.succeededIds.length)}</p>
        <p>{FILESYSTEM_COPY.BATCH_PARTIAL}</p>
        <ul>
          {batch.failures.map((failure) => (
            <li key={failure.id}>
              {actions.selected.find((entry) => entry.id === failure.id)?.name ?? failure.id}: {failure.message}
            </li>
          ))}
        </ul>
      </MobileDialog>
    );
  }
  return null;
}

interface MobileNameDialogProps {
  readonly title: string;
  readonly initialValue: string;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onSubmit: (name: string) => void;
  readonly onClose: () => void;
}

function MobileNameDialog({ title, initialValue, busy, error, onSubmit, onClose }: MobileNameDialogProps) {
  const [name, setName] = useState(initialValue);
  return (
    <MobileDialog title={title} actions={
      <button type="button" disabled={busy} onClick={onClose}>{FILESYSTEM_COPY.CANCEL}</button>
    }>
      <form className={MOBILE_CLASS_NAME.FORM} onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSubmit(name);
      }}>
        <label className={MOBILE_CLASS_NAME.FIELD}>
          {FILESYSTEM_COPY.NAME}
          <input autoFocus value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={busy || !name.trim()}>{FILESYSTEM_COPY.CONFIRM}</button>
      </form>
    </MobileDialog>
  );
}
