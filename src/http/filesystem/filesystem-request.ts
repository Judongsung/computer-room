import { API_QUERY_PARAMETERS } from "@/constants/platform/api";
import { HTTP_ERRORS } from "@/constants/platform/errors/http";
import { DEFAULT_PAGE_OFFSET } from "@/constants/filesystem/pagination";
import { AppError } from "@/domain/shared/errors";
import type { DesktopPlacement } from "@/types/filesystem/filesystem";
import type { AppErrorDefinition } from "@/types/platform/error";
import { parseIntegerParameter } from "@/http/shared/query-parameters";
import { readJsonBody } from "@/http/shared/request-body";

export function readPageParameters(
  url: URL,
  maximumLimit: number,
  invalidLimit: AppErrorDefinition,
): { offset: number; limit: number } {
  const offset = parseIntegerParameter(
    url.searchParams.get(API_QUERY_PARAMETERS.OFFSET),
    DEFAULT_PAGE_OFFSET,
  );
  const limit = parseIntegerParameter(
    url.searchParams.get(API_QUERY_PARAMETERS.LIMIT),
    maximumLimit,
  );
  if (limit < 1 || limit > maximumLimit) throw new AppError(invalidLimit);
  return { offset, limit };
}

export function readIdArray(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((id) => typeof id === "string" && id.length > 0 && id.trim() === id)
  ) {
    throw new AppError(HTTP_ERRORS.INVALID_JSON);
  }
  return [...new Set(value)];
}

export function assertMethod(request: Request, expected: string): void {
  if (request.method !== expected) throw methodNotAllowed();
}

export function methodNotAllowed(): AppError {
  return new AppError(HTTP_ERRORS.METHOD_NOT_ALLOWED);
}

export function readOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new AppError(HTTP_ERRORS.INVALID_JSON);
  return value;
}

export async function readRequiredJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  const body = await readJsonBody(request);
  if (!isRecord(body)) throw new AppError(HTTP_ERRORS.INVALID_JSON);
  return body;
}

export async function readOptionalJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  return request.body ? readRequiredJsonObject(request) : {};
}

export function readDesktopPlacement(
  value: Record<string, unknown>,
): DesktopPlacement | undefined {
  const targetIndex = value.desktopTargetIndex;
  const capacity = value.desktopCapacity;
  if (targetIndex === undefined && capacity === undefined) return undefined;
  if (typeof targetIndex !== "number" || typeof capacity !== "number") {
    throw new AppError(HTTP_ERRORS.INVALID_JSON);
  }
  return { targetIndex, capacity };
}

export function readDesktopPlacementFromQuery(
  url: URL,
): { desktopPlacement?: DesktopPlacement } {
  const targetIndex = url.searchParams.get(API_QUERY_PARAMETERS.DESKTOP_TARGET_INDEX);
  const capacity = url.searchParams.get(API_QUERY_PARAMETERS.DESKTOP_CAPACITY);
  if (targetIndex === null && capacity === null) return {};
  if (targetIndex === null || capacity === null) throw new AppError(HTTP_ERRORS.INVALID_JSON);
  return {
    desktopPlacement: {
      targetIndex: parseIntegerParameter(targetIndex, -1),
      capacity: parseIntegerParameter(capacity, -1),
    },
  };
}

export function contentDisposition(fileName: string, mode: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${mode}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
