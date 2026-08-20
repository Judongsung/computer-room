import { MEMO_ERRORS } from "../constants/errors/memo";
import { AppError } from "./errors";

export function validateMemoMarkdown(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError(MEMO_ERRORS.INVALID_CONTENT);
  }
  return value;
}
