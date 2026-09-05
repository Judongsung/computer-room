import { DESKTOP_DRAG_DATA_TYPE } from "@client/constants/desktop/desktop";
import { FILESYSTEM_DRAG_SOURCE } from "@client/constants/filesystem/filesystem";
import { FILESYSTEM_DROP_EFFECT, NATIVE_FILE_DRAG_DATA_TYPE } from "@client/constants/filesystem/drag";
import type { DragFilesystemEntryPayload } from "@client/types/filesystem/filesystem";

export function writeFilesystemDragPayload(
  dataTransfer: DataTransfer,
  payload: DragFilesystemEntryPayload,
): void {
  dataTransfer.effectAllowed = FILESYSTEM_DROP_EFFECT.MOVE;
  dataTransfer.setData(DESKTOP_DRAG_DATA_TYPE, JSON.stringify(payload));
}

export function hasInternalFilesystemDrag(dataTransfer: Pick<DataTransfer, "types">): boolean {
  return Array.from(dataTransfer.types).includes(DESKTOP_DRAG_DATA_TYPE);
}

export function filesystemDropEffect(
  dataTransfer: Pick<DataTransfer, "types">,
  allowLocalFiles = true,
): DataTransfer["dropEffect"] {
  if (hasInternalFilesystemDrag(dataTransfer)) return FILESYSTEM_DROP_EFFECT.MOVE;
  return allowLocalFiles && Array.from(dataTransfer.types).includes(NATIVE_FILE_DRAG_DATA_TYPE)
    ? FILESYSTEM_DROP_EFFECT.COPY
    : FILESYSTEM_DROP_EFFECT.NONE;
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
