import type { StoredObjectBody } from "./storage";

export interface GeneratedThumbnail {
  readonly body: ArrayBuffer;
  readonly contentType: string;
}

export interface ImageThumbnailGenerator {
  generate(
    source: ReadableStream<Uint8Array>,
  ): Promise<GeneratedThumbnail>;
}

export interface ThumbnailUseCases {
  getThumbnail(entryId: string): Promise<StoredObjectBody>;
}

export interface ThumbnailPreparer {
  prepareThumbnail(entryId: string): Promise<void>;
}
