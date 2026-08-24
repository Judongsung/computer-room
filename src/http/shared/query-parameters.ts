import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { AppError } from "@/domain/shared/errors";

export function parseIntegerParameter(
  value: string | null,
  fallback: number,
): number {
  if (value === null) {
    return fallback;
  }
  if (!/^\d+$/.test(value)) {
    throw new AppError(HTTP_ERRORS.INVALID_QUERY);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new AppError(HTTP_ERRORS.INVALID_QUERY);
  }
  return parsed;
}
