import { HTTP_HEADERS } from "@/constants/platform/http";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import { API_REQUEST_OPTIONS } from "@client/constants/shared/api";
import {
  TEXT_FILE_ENCODING, TEXT_FILE_ERROR_CODE, TEXT_FILE_MAX_BYTES, TEXT_FILE_REQUEST_OPTIONS,
} from "@client/constants/filesystem/text/text-file";
import { TEXT_FILE_ERROR_MESSAGE } from "@client/content/ko/filesystem/text/notepad";
import { ClientError } from "@client/errors/client-error";
import type { FileDownloadSource } from "@client/types/filesystem/text/files";

function textError(code: (typeof TEXT_FILE_ERROR_CODE)[keyof typeof TEXT_FILE_ERROR_CODE]): ClientError {
  return new ClientError({ code, message: TEXT_FILE_ERROR_MESSAGE[code] });
}

export async function readTextFile(
  gateway: FileDownloadSource,
  file: FilesystemFileEntry,
  signal: AbortSignal,
): Promise<string> {
  if (file.size > TEXT_FILE_MAX_BYTES) throw textError(TEXT_FILE_ERROR_CODE.TOO_LARGE);
  const response = await fetch(gateway.downloadUrl(file.id), {
    ...TEXT_FILE_REQUEST_OPTIONS,
    credentials: API_REQUEST_OPTIONS.CREDENTIALS,
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw textError(TEXT_FILE_ERROR_CODE.LOAD_FAILED);
  }
  if (Number(response.headers.get(HTTP_HEADERS.CONTENT_LENGTH)) > TEXT_FILE_MAX_BYTES) {
    await response.body?.cancel();
    throw textError(TEXT_FILE_ERROR_CODE.TOO_LARGE);
  }
  const reader = response.body?.getReader();
  if (!reader) throw textError(TEXT_FILE_ERROR_CODE.LOAD_FAILED);
  const decoder = new TextDecoder(TEXT_FILE_ENCODING, { fatal: true });
  const decode = (value?: Uint8Array, stream = false): string => {
    try { return decoder.decode(value, { stream }); }
    catch { throw textError(TEXT_FILE_ERROR_CODE.INVALID_ENCODING); }
  };
  const parts: string[] = [];
  let size = 0;
  let complete = false;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > TEXT_FILE_MAX_BYTES) throw textError(TEXT_FILE_ERROR_CODE.TOO_LARGE);
      if (value.includes(0)) throw textError(TEXT_FILE_ERROR_CODE.INVALID_ENCODING);
      parts.push(decode(value, true));
    }
    parts.push(decode());
    complete = true;
    return parts.join("");
  } finally {
    try {
      if (!complete) await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }
}
