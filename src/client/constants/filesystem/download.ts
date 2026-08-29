import { FILESYSTEM_ARCHIVE } from "@/constants/filesystem/download";

export const FILESYSTEM_DOWNLOAD_STATUS = {
  IDLE: "idle",
  PREPARING: "preparing",
  DOWNLOADING: "downloading",
  ERROR: "error",
} as const;

export const FILESYSTEM_ARCHIVE_PICKER = {
  MIME_TYPE: FILESYSTEM_ARCHIVE.MIME_TYPE,
  EXTENSIONS: [FILESYSTEM_ARCHIVE.EXTENSION],
} as const;
