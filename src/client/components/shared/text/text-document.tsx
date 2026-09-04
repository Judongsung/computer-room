import { useState } from "react";
import { NOTEPAD_CLASS_NAME } from "@client/constants/filesystem/text/notepad";
import { NOTEPAD_COPY } from "@client/content/ko/filesystem/text/notepad";
import { useTextFile } from "@client/hooks/filesystem/text/use-text-file";
import type { TextDocumentProps } from "@client/types/filesystem/text/files";
import { downloadFile } from "@client/utils/download-file";

export function TextDocument({ file, gateway, wrap = "off" }: TextDocumentProps) {
  const content = useTextFile(file, gateway);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const copy = async (): Promise<void> => {
    if (content.text === null) return;
    try {
      await navigator.clipboard.writeText(content.text);
      setCopyStatus(NOTEPAD_COPY.COPIED);
    } catch {
      setCopyStatus(NOTEPAD_COPY.COPY_FAILED);
    }
  };
  return (
    <div className={NOTEPAD_CLASS_NAME.CONTENT} onKeyDown={(event) => event.stopPropagation()}>
      <div className={NOTEPAD_CLASS_NAME.ACTIONS}>
        <button type="button" disabled={content.text === null} onClick={() => void copy()}>{NOTEPAD_COPY.COPY_ALL}</button>
        <button type="button" onClick={() => downloadFile(gateway.downloadUrl(file.id))}>{NOTEPAD_COPY.DOWNLOAD}</button>
      </div>
      {content.error ? (
        <div className={NOTEPAD_CLASS_NAME.STATUS} role="alert">
          <p>{content.error}</p>
          <button type="button" onClick={content.retry}>{NOTEPAD_COPY.RETRY}</button>
        </div>
      ) : content.text === null ? (
        <p className={NOTEPAD_CLASS_NAME.STATUS} role="status">{NOTEPAD_COPY.LOADING}</p>
      ) : (
        <textarea
          className={NOTEPAD_CLASS_NAME.TEXT}
          aria-label={NOTEPAD_COPY.TEXT_LABEL}
          value={content.text}
          readOnly
          spellCheck={false}
          wrap={wrap}
        />
      )}
      {copyStatus ? <p className={NOTEPAD_CLASS_NAME.STATUS} role="status">{copyStatus}</p> : null}
    </div>
  );
}
