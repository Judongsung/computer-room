import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";

export const NOVELAI_STORAGE_PATH = {
  ROOT_ID: FILESYSTEM_ROOT_ID.DESKTOP,
  DIRECTORY_NAME: "NovelAI",
} as const;

export const NOVELAI_IMAGE_EXTENSION_BY_CONTENT_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/bmp": "bmp",
} as const;
