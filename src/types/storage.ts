export interface StoredObject {
  size: number;
  etag: string;
}

export interface StoredObjectBody extends StoredObject {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  httpEtag: string;
}

export interface StoredObjectRange {
  readonly offset: number;
  readonly length: number;
}

export interface FileObjectStorage {
  put(
    key: string,
    body: ReadableStream<Uint8Array> | null,
    contentType: string,
  ): Promise<StoredObject>;
  get(
    key: string,
    range?: StoredObjectRange,
  ): Promise<StoredObjectBody | null>;
  delete(key: string): Promise<void>;
  deleteMany(keys: readonly string[]): Promise<void>;
}
