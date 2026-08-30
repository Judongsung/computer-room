import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { AppError } from "@/domain/shared/errors";
import type { AppErrorDefinition } from "@/types/platform/error";

export function publicErrorDefinition(error: unknown): AppErrorDefinition {
  if (error instanceof AppError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
    };
  }
  return HTTP_ERRORS.INTERNAL_ERROR;
}
