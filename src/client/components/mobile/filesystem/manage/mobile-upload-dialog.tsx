import { useState } from "react";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { MOBILE_FILESYSTEM_COPY } from "@client/content/ko/mobile/filesystem";
import { MobileDialog } from "@client/components/mobile/shared/mobile-dialog";
import type { useFilesystemUpload } from "@client/hooks/filesystem/use-filesystem-upload";

export function MobileUploadDialog({ transfer }: { readonly transfer: ReturnType<typeof useFilesystemUpload> }) {
  const [discard, setDiscard] = useState(false);
  const { state } = transfer;
  if (!state.isOpen) return null;
  const incomplete = state.succeeded < state.total;
  if (discard) {
    return (
      <MobileDialog title={FILESYSTEM_COPY.TRANSFER_TITLE} actions={
        <>
          <button type="button" onClick={() => {
            setDiscard(false);
            transfer.close();
          }}>{FILESYSTEM_COPY.CONFIRM}</button>
          <button type="button" onClick={() => setDiscard(false)}>{FILESYSTEM_COPY.CANCEL}</button>
        </>
      }>
        <p>{MOBILE_FILESYSTEM_COPY.DISCARD_TRANSFER}</p>
      </MobileDialog>
    );
  }
  return (
    <MobileDialog title={FILESYSTEM_COPY.TRANSFER_TITLE} actions={
      <>
        {state.isRunning ? (
          <button type="button" disabled={state.isStopping} onClick={transfer.stop}>
            {FILESYSTEM_COPY.TRANSFER_STOP}
          </button>
        ) : incomplete ? (
          <button type="button" onClick={() => void transfer.retry()}>{FILESYSTEM_COPY.TRANSFER_RETRY}</button>
        ) : null}
        <button type="button" disabled={state.isRunning}
          onClick={() => incomplete ? setDiscard(true) : transfer.close()}
        >{FILESYSTEM_COPY.CLOSE}</button>
      </>
    }>
      <p>{state.isRunning ? FILESYSTEM_COPY.TRANSFER_PROGRESS
        : incomplete ? FILESYSTEM_COPY.TRANSFER_PARTIAL : FILESYSTEM_COPY.TRANSFER_COMPLETE}</p>
      <progress max={state.total} value={state.completed} />
      <p>{FILESYSTEM_COPY.TRANSFER_COUNTS(state.total, state.succeeded, state.failures.length, state.remaining)}</p>
      {state.isStopping ? <p>{FILESYSTEM_COPY.TRANSFER_STOPPING}</p> : null}
      {state.notice ? <p>{state.notice}</p> : null}
      {!state.isRunning && incomplete ? (
        <>
          <p>{FILESYSTEM_COPY.TRANSFER_RETRY_NOTICE}</p>
          <p>{FILESYSTEM_COPY.TRANSFER_CLOSE_NOTICE}</p>
        </>
      ) : null}
      <ul>
        {state.failures.map((failure, index) => (
          <li key={`${index}:${failure.path}`}>{failure.path}: {failure.message}</li>
        ))}
      </ul>
    </MobileDialog>
  );
}
