import { FILE_ERRORS } from "@/constants/filesystem/errors/file";
import { HTTP_HEADERS } from "@/constants/platform/http";
import { AppError } from "@/domain/shared/errors";

const NON_NEGATIVE_INTEGER_PATTERN = /^\d+$/u;

export function readDeclaredFileSize(request: Request): number {
  const value = request.headers.get(HTTP_HEADERS.FILE_SIZE);
  if (!value || !NON_NEGATIVE_INTEGER_PATTERN.test(value)) {
    throw new AppError(FILE_ERRORS.INVALID_FILE_SIZE);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new AppError(FILE_ERRORS.INVALID_FILE_SIZE);
  }
  return parsed;
}
