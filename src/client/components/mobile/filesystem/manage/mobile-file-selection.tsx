import type { ReactNode } from "react";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { MOBILE_FILESYSTEM_COPY } from "@client/content/ko/mobile/filesystem";
import { MOBILE_CLASS_NAME } from "@client/constants/mobile/class-names";
import { MobileEntryIcon } from "@client/components/mobile/filesystem/mobile-entry-icon";
import type { useMobileFileActions } from "@client/hooks/mobile/filesystem/use-mobile-file-actions";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

interface Props {
  readonly actions: ReturnType<typeof useMobileFileActions>;
  readonly entries: readonly FilesystemEntry[];
  readonly gateway: FilesystemGateway;
  readonly busy: boolean;
  readonly trash?: boolean;
  readonly restoreBlocked?: boolean;
  readonly metadata?: (entry: FilesystemEntry) => ReactNode;
}

export function MobileFileSelection({ actions, entries, gateway, busy, trash = false, restoreBlocked = false, metadata }: Props) {
  const count = actions.selected.length;
  return <>
    <p>{FILESYSTEM_COPY.SELECTED_COUNT(count)}</p>
    <div className={MOBILE_CLASS_NAME.BUTTON_ROW}>
      <button type="button" disabled={busy} onClick={actions.selection.selectAll}>{MOBILE_FILESYSTEM_COPY.SELECT_ALL}</button>
      <button type="button" disabled={busy} onClick={actions.cancelSelection}>{MOBILE_FILESYSTEM_COPY.CANCEL_SELECTION}</button>
      {trash ? <>
        <button type="button" disabled={busy || !count || restoreBlocked} onClick={() => void actions.restore()}>{FILESYSTEM_COPY.RESTORE}</button>
        <button type="button" disabled={busy || !count} onClick={() => actions.openDialog("delete")}>{FILESYSTEM_COPY.PERMANENT_DELETE}</button>
      </> : <>
        <button type="button" disabled={busy || count !== 1} onClick={() => actions.openDialog("rename")}>{FILESYSTEM_COPY.RENAME}</button>
        <button type="button" disabled={busy || !count} onClick={() => actions.openDialog("move")}>{FILESYSTEM_COPY.MOVE}</button>
        <button type="button" disabled={busy || !count} onClick={() => actions.openDialog("trash")}>{FILESYSTEM_COPY.DELETE}</button>
      </>}
    </div>
    <ul className={MOBILE_CLASS_NAME.LIST}>
      {entries.map((entry) => <li key={entry.id}>
        <label className={MOBILE_CLASS_NAME.LIST_ITEM}>
          <input type="checkbox" checked={actions.selection.selectedIds.has(entry.id)} disabled={busy}
            onChange={() => actions.selection.select(entry.id, { ctrlKey: true, metaKey: false, shiftKey: false })} />
          <span className={MOBILE_CLASS_NAME.LIST_ICON}><MobileEntryIcon entry={entry} gateway={gateway} /></span>
          <span className={MOBILE_CLASS_NAME.LIST_TEXT}><strong>{entry.name}</strong>{metadata?.(entry)}</span>
        </label>
      </li>)}
    </ul>
  </>;
}
