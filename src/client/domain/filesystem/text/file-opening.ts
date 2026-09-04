import { isPotentialMediaContentType, mediaKindFromContentType } from "@/domain/filesystem/media-type";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import {
  FILE_OPEN_KIND, TEXT_FILE_EXTENSIONS, TEXT_FILE_MIME_PREFIX, TEXT_FILE_MIME_TYPES,
} from "@client/constants/filesystem/text/file-opening";
import type { FileOpenHandlers, FileOpenKind } from "@client/types/filesystem/text/files";

export function fileOpenKind(file: Pick<FilesystemFileEntry, "name" | "contentType">): FileOpenKind {
  const mime = file.contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const media = mediaKindFromContentType(mime);
  if (media) return media;
  if (isPotentialMediaContentType(mime)) return FILE_OPEN_KIND.DOWNLOAD;
  const extension = file.name.includes(".") ? file.name.split(".").at(-1)?.toLowerCase() : undefined;
  return (TEXT_FILE_EXTENSIONS as readonly string[]).includes(extension ?? "") ||
    mime.startsWith(TEXT_FILE_MIME_PREFIX) ||
    (TEXT_FILE_MIME_TYPES as readonly string[]).includes(mime)
    ? FILE_OPEN_KIND.TEXT : FILE_OPEN_KIND.DOWNLOAD;
}

export function createFileOpener(handlers: FileOpenHandlers): (file: FilesystemFileEntry) => void {
  const commands = {
    [FILE_OPEN_KIND.IMAGE]: (entry) => handlers.media({ entry, directoryId: entry.parentId, kind: FILE_OPEN_KIND.IMAGE }),
    [FILE_OPEN_KIND.VIDEO]: (entry) => handlers.media({ entry, directoryId: entry.parentId, kind: FILE_OPEN_KIND.VIDEO }),
    [FILE_OPEN_KIND.TEXT]: handlers.text,
    [FILE_OPEN_KIND.DOWNLOAD]: handlers.download,
  } satisfies Record<FileOpenKind, (entry: FilesystemFileEntry) => void>;
  return (file) => commands[fileOpenKind(file)](file);
}
