import type { ChangeEvent, RefObject } from "react";
import { FILESYSTEM_COPY } from "@client/constants/filesystem/filesystem";

interface DocumentsToolbarProps {
  readonly busy: boolean;
  readonly canGoBack: boolean;
  readonly canGoUp: boolean;
  readonly canMutate: boolean;
  readonly canDownload: boolean;
  readonly canRename: boolean;
  readonly hasSelection: boolean;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly folderInputRef: RefObject<HTMLInputElement | null>;
  readonly onBack: () => void;
  readonly onUp: () => void;
  readonly onCreate: () => void;
  readonly onSelectFiles: () => void;
  readonly onSelectFolder: () => void;
  readonly onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onDownload: () => void;
  readonly onRename: () => void;
  readonly onMove: () => void;
  readonly onDelete: () => void;
}

export function DocumentsToolbar({
  busy,
  canGoBack,
  canGoUp,
  canMutate,
  canDownload,
  canRename,
  hasSelection,
  fileInputRef,
  folderInputRef,
  onBack,
  onUp,
  onCreate,
  onSelectFiles,
  onSelectFolder,
  onUpload,
  onDownload,
  onRename,
  onMove,
  onDelete,
}: DocumentsToolbarProps) {
  return (
    <div className="explorer-toolbar" aria-label={FILESYSTEM_COPY.FILE_TOOLBAR}>
      <button type="button" disabled={!canGoBack || busy} onClick={onBack}>{FILESYSTEM_COPY.BACK}</button>
      <button type="button" disabled={!canGoUp || busy} onClick={onUp}>{FILESYSTEM_COPY.UP}</button>
      <span className="explorer-toolbar__separator" />
      <button type="button" disabled={!canMutate || busy} onClick={onCreate}>{FILESYSTEM_COPY.NEW_FOLDER}</button>
      <button type="button" disabled={!canMutate || busy} onClick={onSelectFiles}>{FILESYSTEM_COPY.UPLOAD_FILES}</button>
      <button type="button" disabled={!canMutate || busy} onClick={onSelectFolder}>{FILESYSTEM_COPY.UPLOAD_FOLDER}</button>
      <input ref={fileInputRef} className="visually-hidden" type="file" multiple onChange={onUpload} />
      <input ref={folderInputRef} className="visually-hidden" type="file" multiple {...{ webkitdirectory: "" }} onChange={onUpload} />
      <span className="explorer-toolbar__separator" />
      <button type="button" disabled={!canDownload || busy} onClick={onDownload}>{FILESYSTEM_COPY.DOWNLOAD}</button>
      <button type="button" disabled={!canRename || busy} onClick={onRename}>{FILESYSTEM_COPY.RENAME}</button>
      <button type="button" disabled={!hasSelection || busy} onClick={onMove}>{FILESYSTEM_COPY.MOVE}</button>
      <button type="button" disabled={!hasSelection || busy} onClick={onDelete}>{FILESYSTEM_COPY.DELETE}</button>
    </div>
  );
}
