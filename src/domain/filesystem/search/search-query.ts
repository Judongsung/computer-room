import { MAX_FILE_NAME_BYTES } from "@/constants/filesystem/file";
import { FILESYSTEM_SEARCH_KIND } from "@/constants/filesystem/search";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { AppError } from "@/domain/shared/errors";
import type { FilesystemSearchKind } from "@/types/filesystem/search/search";

export function isFilesystemSearchKind(value: string): value is FilesystemSearchKind {
  return Object.values(FILESYSTEM_SEARCH_KIND).some((kind) => kind === value);
}

export function normalizeSearchQuery(value: string): string {
  const normalized = value.normalize("NFC").trim();
  if (!normalized || new TextEncoder().encode(normalized).length > MAX_FILE_NAME_BYTES) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_SEARCH);
  }
  return filesystemNameKey(normalized);
}
