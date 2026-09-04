import { useEffect, useState } from "react";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import { readTextFile } from "@client/api/filesystem/text/read-text-file";
import { TEXT_FILE_ERROR_CODE } from "@client/constants/filesystem/text/text-file";
import { TEXT_FILE_ERROR_MESSAGE } from "@client/content/ko/filesystem/text/notepad";
import { ClientError } from "@client/errors/client-error";
import type { FileDownloadSource } from "@client/types/filesystem/text/files";

export function useTextFile(file: FilesystemFileEntry, gateway: FileDownloadSource) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ text: string | null; error: string | null }>({ text: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    setState({ text: null, error: null });
    void readTextFile(gateway, file, controller.signal).then(
      (text) => { if (!controller.signal.aborted) setState({ text, error: null }); },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({
          text: null,
          error: error instanceof ClientError ? error.message : TEXT_FILE_ERROR_MESSAGE[TEXT_FILE_ERROR_CODE.LOAD_FAILED],
        });
      },
    );
    return () => controller.abort();
  }, [file, gateway, revision]);
  return { ...state, retry: () => setRevision((current) => current + 1) };
}
