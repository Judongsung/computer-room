import type { FileObjectStorage, StoredObject, StoredObjectBody, StoredObjectRange } from "@/types/filesystem/storage";

interface MemoryObject { bytes: Uint8Array; contentType: string; etag: string }

export class MemoryObjectStorage implements FileObjectStorage {
  readonly objects = new Map<string, MemoryObject>();
  readonly getKeys: string[] = [];
  readonly putKeys: string[] = [];
  reportedSizeOffset = 0;
  failOnPut = false;
  failOnDelete = false;

  async put(
    key: string,
    body: ReadableStream<Uint8Array> | ArrayBuffer | null,
    contentType: string,
  ): Promise<StoredObject> {
    this.putKeys.push(key);
    if (this.failOnPut) {
      throw new Error("Storage failure");
    }

    const bytes = body
      ? new Uint8Array(await new Response(body).arrayBuffer())
      : new Uint8Array();
    const object = { bytes, contentType, etag: `etag-${key}` };
    this.objects.set(key, object);
    return {
      size: bytes.byteLength + this.reportedSizeOffset,
      etag: object.etag,
      httpEtag: `"${object.etag}"`,
    };
  }

  async get(
    key: string,
    range?: StoredObjectRange,
  ): Promise<StoredObjectBody | null> {
    this.getKeys.push(key);
    const object = this.objects.get(key);
    if (!object) {
      return null;
    }

    const bytes = range
      ? object.bytes.slice(range.offset, range.offset + range.length)
      : object.bytes;
    return {
      body: new Blob([bytes]).stream(),
      size: object.bytes.byteLength,
      etag: object.etag,
      httpEtag: `"${object.etag}"`,
      contentType: object.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    if (this.failOnDelete) throw new Error("Storage delete failure");
    this.objects.delete(key);
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    if (this.failOnDelete) throw new Error("Storage delete failure");
    for (const key of keys) this.objects.delete(key);
  }
}
