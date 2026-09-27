import { MAX_FILE_NAME_BYTES } from "@/constants/filesystem/file";
import { FILESYSTEM_SEARCH_KIND, FILESYSTEM_SEARCH_MODE } from "@/constants/filesystem/search";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { AppError } from "@/domain/shared/errors";
import type { FilesystemSearchKind, FilesystemSearchMode } from "@/types/filesystem/search/search";

export function isFilesystemSearchMode(value: string): value is FilesystemSearchMode {
  return Object.values(FILESYSTEM_SEARCH_MODE).some((mode) => mode === value);
}

export function validateSearchQuery(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || new TextEncoder().encode(trimmed).length > MAX_FILE_NAME_BYTES) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_SEARCH);
  }
  return trimmed;
}

export function isFilesystemSearchKind(value: string): value is FilesystemSearchKind {
  return Object.values(FILESYSTEM_SEARCH_KIND).some((kind) => kind === value);
}

export function normalizeSearchQuery(value: string): string {
  return filesystemNameKey(validateSearchQuery(value.normalize("NFC")));
}
