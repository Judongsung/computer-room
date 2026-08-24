import { STORAGE_STATUS_ERRORS } from "@/constants/storage/errors/storage-status";
import {
  STORAGE_MIME_CATEGORY,
  STORAGE_OBJECT_PURPOSE,
  R2_STORAGE_CLASS,
  R2_STORAGE_USAGE_LIST_LIMIT,
} from "@/constants/storage/storage-status";
import { AppError } from "@/domain/shared/errors";
import {
  addStorageUsage,
  storageMimeCategory,
  storageObjectPurpose,
} from "@/domain/storage/storage-status";
import type {
  ObjectStorageUsage,
  ObjectStorageUsageReader,
  StorageUsageValue,
} from "@/types/storage/storage-status";

interface MutableStorageUsageValue {
  bytes: number;
  objectCount: number;
}

interface MutableObjectStorageUsage {
  total: MutableStorageUsageValue;
  standard: MutableStorageUsageValue;
  byPurpose: Record<
    (typeof STORAGE_OBJECT_PURPOSE)[keyof typeof STORAGE_OBJECT_PURPOSE],
    MutableStorageUsageValue
  >;
  byMimeCategory: Record<
    (typeof STORAGE_MIME_CATEGORY)[keyof typeof STORAGE_MIME_CATEGORY],
    MutableStorageUsageValue
  >;
}

interface UsageListObject {
  readonly key: string;
  readonly size: number;
  readonly storageClass?: string;
  readonly httpMetadata?: Pick<R2HTTPMetadata, "contentType">;
}

interface UsageListPage {
  readonly objects: readonly UsageListObject[];
  readonly truncated: boolean;
  readonly cursor?: string;
}

interface ObjectUsageBucket {
  list(options: R2ListOptions): Promise<UsageListPage>;
}

export class R2ObjectStorageUsageReader implements ObjectStorageUsageReader {
  constructor(private readonly bucket: ObjectUsageBucket) {}

  async readUsage(): Promise<ObjectStorageUsage> {
    const usage = createMutableObjectStorageUsage();
    let cursor: string | undefined;

    do {
      const page = await this.bucket.list({
        limit: R2_STORAGE_USAGE_LIST_LIMIT,
        include: ["httpMetadata"],
        ...(cursor ? { cursor } : {}),
      });
      for (const object of page.objects) {
        this.accumulate(usage, object);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor !== undefined);

    return usage;
  }

  private accumulate(
    usage: MutableObjectStorageUsage,
    object: UsageListObject,
  ): void {
    if (!Number.isSafeInteger(object.size) || object.size < 0) {
      throw new AppError(STORAGE_STATUS_ERRORS.INVALID_USAGE);
    }
    const purpose = storageObjectPurpose(object.key);
    const category = storageMimeCategory(object.httpMetadata?.contentType);
    usage.total = checkedUsage(usage.total, object.size);
    usage.byPurpose[purpose] = checkedUsage(
      usage.byPurpose[purpose],
      object.size,
    );
    usage.byMimeCategory[category] = checkedUsage(
      usage.byMimeCategory[category],
      object.size,
    );
    if (isStandardStorageClass(object.storageClass)) {
      usage.standard = checkedUsage(usage.standard, object.size);
    }
  }
}

function createMutableObjectStorageUsage(): MutableObjectStorageUsage {
  return {
    total: emptyUsage(),
    standard: emptyUsage(),
    byPurpose: {
      [STORAGE_OBJECT_PURPOSE.ORIGINAL]: emptyUsage(),
      [STORAGE_OBJECT_PURPOSE.THUMBNAIL]: emptyUsage(),
      [STORAGE_OBJECT_PURPOSE.OTHER]: emptyUsage(),
    },
    byMimeCategory: {
      [STORAGE_MIME_CATEGORY.IMAGE]: emptyUsage(),
      [STORAGE_MIME_CATEGORY.VIDEO]: emptyUsage(),
      [STORAGE_MIME_CATEGORY.AUDIO]: emptyUsage(),
      [STORAGE_MIME_CATEGORY.DOCUMENT]: emptyUsage(),
      [STORAGE_MIME_CATEGORY.ARCHIVE]: emptyUsage(),
      [STORAGE_MIME_CATEGORY.OTHER]: emptyUsage(),
    },
  };
}

function emptyUsage(): MutableStorageUsageValue {
  return { bytes: 0, objectCount: 0 } satisfies StorageUsageValue;
}

function isStandardStorageClass(storageClass: string | undefined): boolean {
  return !storageClass || storageClass === R2_STORAGE_CLASS.STANDARD;
}

function checkedUsage(
  current: StorageUsageValue,
  bytes: number,
): MutableStorageUsageValue {
  const next = addStorageUsage(current, bytes);
  if (
    !Number.isSafeInteger(next.bytes) ||
    !Number.isSafeInteger(next.objectCount)
  ) {
    throw new AppError(STORAGE_STATUS_ERRORS.INVALID_USAGE);
  }
  return next;
}
