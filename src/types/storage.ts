export interface StoredObject {
  size: number;
  etag: string;
}

export interface StoredObjectBody extends StoredObject {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  httpEtag: string;
}

export interface FileObjectStorage {
  put(
    key: string,
    body: ReadableStream<Uint8Array> | null,
    contentType: string,
  ): Promise<StoredObject>;
  get(key: string): Promise<StoredObjectBody | null>;
  delete(key: string): Promise<void>;
  deleteMany(keys: readonly string[]): Promise<void>;
}
