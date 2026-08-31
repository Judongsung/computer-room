import { GUEST_PUBLICATION_STATE_VALUES } from "@/constants/admin/guest-access";
import { isFilesystemDirectorySort } from "@/domain/filesystem/filesystem-sort";
import type {
  GuestAccessDirectoryPage,
  GuestAccessSettings,
  GuestPublicationMutationResult,
} from "@/types/admin/guest-access";
import {
  isDirectoryEntry,
  isFilesystemEntry,
} from "@client/api/filesystem/filesystem-api-contract";
import { isRecord } from "@client/api/shared/api-contract";

export function isGuestAccessSettings(
  value: unknown,
): value is GuestAccessSettings {
  return isRecord(value) && typeof value.enabled === "boolean";
}

export function isGuestAccessDirectoryPage(
  value: unknown,
): value is GuestAccessDirectoryPage {
  return (
    isRecord(value) &&
    isDirectoryEntry(value.directory) &&
    Array.isArray(value.breadcrumbs) &&
    value.breadcrumbs.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string",
    ) &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isRecord(item) &&
        isFilesystemEntry(item.entry) &&
        GUEST_PUBLICATION_STATE_VALUES.some(
          (state) => state === item.publicationState,
        ),
    ) &&
    (value.nextOffset === null || typeof value.nextOffset === "number") &&
    isFilesystemDirectorySort(value.sort)
  );
}

export function isGuestPublicationMutationResult(
  value: unknown,
): value is GuestPublicationMutationResult {
  return (
    isRecord(value) &&
    typeof value.entryId === "string" &&
    GUEST_PUBLICATION_STATE_VALUES.some(
      (state) => state === value.publicationState,
    ) &&
    typeof value.affectedCount === "number" &&
    Number.isSafeInteger(value.affectedCount) &&
    value.affectedCount >= 0
  );
}
