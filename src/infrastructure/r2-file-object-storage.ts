import { FILE_ERRORS } from "../constants/errors/file";
import { DEFAULT_CONTENT_TYPE } from "../constants/file";
import { R2_DELETE_BATCH_SIZE } from "../constants/filesystem";
import { AppError } from "../domain/errors";
import type {
  FileObjectStorage,
  StoredObject,
  StoredObjectBody,
} from "../types/storage";

export class R2FileObjectStorage implements FileObjectStorage {
  constructor(private readonly bucket: R2Bucket) {}

  async put(
    key: string,
    body: ReadableStream<Uint8Array> | null,
    contentType: string,
  ): Promise<StoredObject> {
    const object = await this.bucket.put(key, body, {
      httpMetadata: { contentType },
    });

    if (!object) {
      throw new AppError(FILE_ERRORS.STORAGE_WRITE_FAILED);
    }

    return {
      size: object.size,
      etag: object.etag,
    };
  }

  async get(key: string): Promise<StoredObjectBody | null> {
    const object = await this.bucket.get(key);

    if (!object) {
      return null;
    }

    return {
      body: object.body,
      size: object.size,
      etag: object.etag,
      httpEtag: object.httpEtag,
      contentType: object.httpMetadata?.contentType ?? DEFAULT_CONTENT_TYPE,
    };
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    for (let offset = 0; offset < keys.length; offset += R2_DELETE_BATCH_SIZE) {
      await this.bucket.delete(keys.slice(offset, offset + R2_DELETE_BATCH_SIZE));
    }
  }
}
