import { FILE_ERRORS } from "../constants/errors/file";
import { DEFAULT_CONTENT_TYPE } from "../constants/file";
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
}
