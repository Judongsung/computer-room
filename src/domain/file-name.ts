import { FILE_ERRORS } from "../constants/errors/file";
import {
  DEFAULT_CONTENT_TYPE,
  MAX_CONTENT_TYPE_LENGTH,
  MAX_FILE_NAME_BYTES,
} from "../constants/file";
import { AppError } from "./errors";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const PATH_SEPARATORS = /[\\/]/g;

export function normalizeFileName(input: string): string {
  const normalized = input
    .normalize("NFC")
    .replace(PATH_SEPARATORS, "_")
    .replace(CONTROL_CHARACTERS, "")
    .trim();

  if (!normalized || normalized === "." || normalized === "..") {
    throw new AppError(FILE_ERRORS.INVALID_FILE_NAME);
  }

  if (new TextEncoder().encode(normalized).byteLength > MAX_FILE_NAME_BYTES) {
    throw new AppError(FILE_ERRORS.FILE_NAME_TOO_LONG);
  }

  return normalized;
}

export function normalizeContentType(input: string | null): string {
  const value = input?.trim().toLowerCase() || DEFAULT_CONTENT_TYPE;

  if (value.length > MAX_CONTENT_TYPE_LENGTH || CONTROL_CHARACTER.test(value)) {
    throw new AppError(FILE_ERRORS.INVALID_CONTENT_TYPE);
  }

  return value;
}
