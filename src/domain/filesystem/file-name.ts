import { FILE_ERRORS } from "@/constants/filesystem/errors/file";
import {
  DEFAULT_CONTENT_TYPE,
  MAX_CONTENT_TYPE_LENGTH,
} from "@/constants/filesystem/file";
import { AppError } from "@/domain/shared/errors";

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

export function normalizeContentType(input: string | null): string {
  const value = input?.trim().toLowerCase() || DEFAULT_CONTENT_TYPE;

  if (value.length > MAX_CONTENT_TYPE_LENGTH || CONTROL_CHARACTER.test(value)) {
    throw new AppError(FILE_ERRORS.INVALID_CONTENT_TYPE);
  }

  return value;
}
