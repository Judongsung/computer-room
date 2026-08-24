import { MEMO_ERRORS } from "@/constants/widgets/errors/memo";
import { AppError } from "@/domain/shared/errors";

export function validateMemoMarkdown(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError(MEMO_ERRORS.INVALID_CONTENT);
  }
  return value;
}
