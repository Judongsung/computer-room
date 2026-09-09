import { HTTP_LOG_MESSAGES } from "@/constants/platform/errors/http";

function errorType(error: unknown): string {
  if (error instanceof TypeError) return "TypeError";
  if (error instanceof RangeError) return "RangeError";
  if (error instanceof SyntaxError) return "SyntaxError";
  if (error instanceof ReferenceError) return "ReferenceError";
  if (error instanceof URIError) return "URIError";
  if (error instanceof EvalError) return "EvalError";
  if (error instanceof AggregateError) return "AggregateError";
  if (error instanceof Error) return "Error";
  return error === null ? "null" : typeof error;
}

export function reportUnexpectedApiError(error: unknown): void {
  console.error(JSON.stringify({
    event: HTTP_LOG_MESSAGES.UNHANDLED_API_ERROR,
    errorType: errorType(error),
  }));
}
