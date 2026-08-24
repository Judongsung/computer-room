import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { AppError } from "@/domain/shared/errors";
import type { DesktopPlacement } from "@/types/filesystem/filesystem";
import type { FilesystemRepository } from "@/types/filesystem/repository";

export async function nextDesktopOrder(
  repository: FilesystemRepository,
  parentId: string,
  placement?: DesktopPlacement,
): Promise<number | undefined> {
  if (parentId !== FILESYSTEM_ROOT_ID.DESKTOP) {
    if (placement) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_DESKTOP_PLACEMENT);
    }
    return undefined;
  }
  const entryIds = await repository.listDesktopEntryIds();
  if (placement) {
    assertDesktopPlacement(placement);
    if (entryIds.length >= placement.capacity) {
      throw new AppError(FILESYSTEM_ERRORS.DESKTOP_FULL);
    }
  }
  return entryIds.length;
}

export function assertDesktopPlacement(placement: DesktopPlacement): void {
  if (
    !Number.isSafeInteger(placement.targetIndex) ||
    placement.targetIndex < 0 ||
    !Number.isSafeInteger(placement.capacity) ||
    placement.capacity < 1 ||
    placement.targetIndex > placement.capacity
  ) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_DESKTOP_PLACEMENT);
  }
}
