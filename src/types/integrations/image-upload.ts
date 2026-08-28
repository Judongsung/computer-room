import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";

export interface ImageUploadInput {
  readonly contentType: string | null;
  readonly declaredSize: number;
  readonly body: ReadableStream<Uint8Array> | null;
}

export interface ImageUploadUseCases {
  uploadImage(
    profileId: string,
    input: ImageUploadInput,
  ): Promise<FilesystemFileEntry>;
}

export interface ImageUploadResponse {
  readonly file: FilesystemFileEntry;
}
