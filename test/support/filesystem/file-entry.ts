import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";

export function fileEntry(
  id: string,
  name: string,
  contentType: string,
): FilesystemFileEntry {
  return {
    id,
    parentId: FILESYSTEM_ROOT_ID.DESKTOP,
    kind: FILESYSTEM_ENTRY_KIND.FILE,
    name,
    contentType,
    size: 10,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    desktopOrder: 0,
  };
}
