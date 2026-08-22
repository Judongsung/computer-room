import type { NOVELAI_IMAGE_EXTENSION_BY_CONTENT_TYPE } from "../constants/novelai";
import type { FilesystemFileEntry } from "./filesystem";

export type NovelAiImageContentType =
  keyof typeof NOVELAI_IMAGE_EXTENSION_BY_CONTENT_TYPE;

export interface NovelAiImageUploadInput {
  readonly contentType: string | null;
  readonly declaredSize: number;
  readonly body: ReadableStream<Uint8Array> | null;
}

export interface NovelAiImageUseCases {
  uploadImage(input: NovelAiImageUploadInput): Promise<FilesystemFileEntry>;
}

export interface NovelAiImageUploadResponse {
  readonly file: FilesystemFileEntry;
}
