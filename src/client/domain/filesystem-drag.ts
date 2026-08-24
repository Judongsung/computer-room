import { DESKTOP_DRAG_DATA_TYPE } from "../constants/desktop";
import { FILESYSTEM_DRAG_SOURCE } from "../constants/filesystem";
import type { DragFilesystemEntryPayload } from "../types/filesystem";

export function writeFilesystemDragPayload(
  dataTransfer: DataTransfer,
  payload: DragFilesystemEntryPayload,
): void {
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(DESKTOP_DRAG_DATA_TYPE, JSON.stringify(payload));
}

export function readFilesystemDragPayload(
  dataTransfer: DataTransfer,
): DragFilesystemEntryPayload | null {
  const serialized = dataTransfer.getData(DESKTOP_DRAG_DATA_TYPE);
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (
      typeof value === "object" &&
      value !== null &&
      "ids" in value &&
      Array.isArray(value.ids) &&
      value.ids.length > 0 &&
      value.ids.every(
        (id) =>
          typeof id === "string" && id.length > 0 && id.trim() === id,
      ) &&
      "primaryId" in value &&
      typeof value.primaryId === "string" &&
      value.ids.includes(value.primaryId) &&
      "source" in value &&
      (value.source === FILESYSTEM_DRAG_SOURCE.ACTIVE ||
        value.source === FILESYSTEM_DRAG_SOURCE.TRASH)
    ) {
      return {
        ids: [...new Set(value.ids)],
        primaryId: value.primaryId,
        source: value.source,
      };
    }
  } catch {
    return null;
  }
  return null;
}
