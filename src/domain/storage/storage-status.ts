import {
  STORAGE_MIME_CATEGORY,
  STORAGE_MIME_CLASSIFICATION_RULES,
  STORAGE_MIME_CATEGORY_VALUES,
  STORAGE_OBJECT_PURPOSE,
  STORAGE_OBJECT_PURPOSE_RULES,
  STORAGE_OBJECT_PURPOSE_VALUES,
} from "@/constants/storage/storage-status";
import type {
  DatabaseStorageUsage,
  ObjectStorageUsage,
  StorageStatusSnapshot,
  StorageMimeCategory,
  StorageObjectPurpose,
  StorageUsageValue,
} from "@/types/storage/storage-status";

const CONTENT_TYPE_PARAMETER_SEPARATOR = ";";

export function storageMimeCategory(
  contentType: string | undefined,
): StorageMimeCategory {
  const normalized = normalizeContentType(contentType);
  return (
    STORAGE_MIME_CLASSIFICATION_RULES.find(
      (rule) =>
        rule.prefixes.some((prefix) => normalized.startsWith(prefix)) ||
        (rule.contentTypes as readonly string[]).includes(normalized),
    )?.category ?? STORAGE_MIME_CATEGORY.OTHER
  );
}

export function storageObjectPurpose(key: string): StorageObjectPurpose {
  return (
    STORAGE_OBJECT_PURPOSE_RULES.find((rule) => key.startsWith(rule.prefix))
      ?.purpose ?? STORAGE_OBJECT_PURPOSE.OTHER
  );
}

export function addStorageUsage(
  current: StorageUsageValue,
  bytes: number,
): StorageUsageValue {
  return {
    bytes: current.bytes + bytes,
    objectCount: current.objectCount + 1,
  };
}

function normalizeContentType(contentType: string | undefined): string {
  return (
    contentType
      ?.split(CONTENT_TYPE_PARAMETER_SEPARATOR, 1)[0]
      ?.trim()
      .toLowerCase() ?? ""
  );
}

export function isStorageStatusSnapshot(
  value: unknown,
): value is StorageStatusSnapshot {
  return (
    isRecord(value) &&
    typeof value.measuredAt === "string" &&
    isObjectStorageUsage(value.r2) &&
    isDatabaseStorageUsage(value.d1)
  );
}

function isObjectStorageUsage(value: unknown): value is ObjectStorageUsage {
  if (!isRecord(value) || !isRecord(value.byPurpose) || !isRecord(value.byMimeCategory)) {
    return false;
  }
  const byPurpose = value.byPurpose;
  const byMimeCategory = value.byMimeCategory;
  return (
    isUsageValue(value.total) &&
    isUsageValue(value.standard) &&
    STORAGE_OBJECT_PURPOSE_VALUES.every((key) =>
      isUsageValue(byPurpose[key]),
    ) &&
    STORAGE_MIME_CATEGORY_VALUES.every((key) =>
      isUsageValue(byMimeCategory[key]),
    )
  );
}

function isDatabaseStorageUsage(
  value: unknown,
): value is DatabaseStorageUsage {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.databaseBytes) &&
    isNonNegativeInteger(value.registeredFileCount) &&
    isNonNegativeInteger(value.directoryCount) &&
    isNonNegativeInteger(value.widgetCount) &&
    isNonNegativeInteger(value.trashItemCount)
  );
}

function isUsageValue(value: unknown): value is StorageUsageValue {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.bytes) &&
    isNonNegativeInteger(value.objectCount)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
