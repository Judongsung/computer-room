import { MEDIA_KIND } from "@/constants/filesystem/media";

export const FILE_OPEN_KIND = {
  IMAGE: MEDIA_KIND.IMAGE,
  VIDEO: MEDIA_KIND.VIDEO,
  TEXT: "text",
  DOWNLOAD: "download",
} as const;

export const TEXT_FILE_EXTENSIONS = [
  "txt", "json", "md", "markdown", "log", "csv", "tsv", "yaml", "yml",
  "xml", "ini", "conf", "toml",
] as const;
export const TEXT_FILE_MIME_PREFIX = "text/";
export const TEXT_FILE_MIME_TYPES = [
  "application/json", "application/xml", "application/yaml", "application/toml",
] as const;
