import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { AppError } from "@/domain/shared/errors";
import { readJsonBody } from "@/http/shared/request-body";

export function assertMethod(request: Request, expected: string): void {
  if (request.method !== expected) throw methodNotAllowed();
}

export function methodNotAllowed(): AppError {
  return new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
}

export async function readRecordBody(request: Request): Promise<Record<string, unknown>> {
  const body = await readJsonBody(request);
  if (!isRecord(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
  return body;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
