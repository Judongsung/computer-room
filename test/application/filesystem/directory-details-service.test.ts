import { describe, expect, it, vi } from "vitest";
import { DirectoryDetailsService } from "@/application/filesystem/directory-details-service";
import { FilesystemDirectoryService } from "@/application/filesystem/directory/filesystem-directory-service";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import type { DirectoryDetailsRepository } from "@/types/filesystem/directory-details";
import {
  MemoryDirectorySortRepository,
  MemoryFileRepository,
} from "@test/support/filesystem/memory-filesystem-repository";
import { SequenceIdGenerator, StaticClock } from "@test/support/platform/runtime-fakes";

const NOW = Date.parse("2026-08-25T01:02:03.000Z");

describe("DirectoryDetailsService", () => {
  it("returns recursive statistics and breadcrumbs for an active directory", async () => {
    const entries = new MemoryFileRepository();
    const directories = new FilesystemDirectoryService(
      entries,
      new MemoryDirectorySortRepository(),
      new SequenceIdGenerator(["photos"]),
      new StaticClock(NOW),
    );
    const directory = await directories.createDirectory(null, "사진");
    const readStatistics = vi
      .fn<DirectoryDetailsRepository["readStatistics"]>()
      .mockResolvedValue({
        totalBytes: 4_096,
        fileCount: 3,
        directoryCount: 2,
        widgetCount: 1,
      });
    const service = new DirectoryDetailsService(entries, { readStatistics });

    await expect(service.getDetails(directory.id)).resolves.toEqual({
      directory: {
        id: directory.id,
        parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
        kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
        name: "사진",
        createdAt: new Date(NOW).toISOString(),
        updatedAt: new Date(NOW).toISOString(),
        desktopOrder: null,
      },
      breadcrumbs: [
        { id: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "내 문서" },
        { id: directory.id, name: "사진" },
      ],
      totalBytes: 4_096,
      fileCount: 3,
      directoryCount: 2,
      widgetCount: 1,
    });
    expect(readStatistics).toHaveBeenCalledOnce();
    expect(readStatistics).toHaveBeenCalledWith(directory.id);
  });

  it("does not expose missing or recycle-bin directories", async () => {
    const entries = new MemoryFileRepository();
    const readStatistics = vi
      .fn<DirectoryDetailsRepository["readStatistics"]>()
      .mockResolvedValue({
        totalBytes: 0,
        fileCount: 0,
        directoryCount: 0,
        widgetCount: 0,
      });
    const service = new DirectoryDetailsService(entries, { readStatistics });

    await expect(service.getDetails("missing")).rejects.toMatchObject({
      code: FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND.code,
    });
    await expect(
      service.getDetails(FILESYSTEM_ROOT_ID.RECYCLE_BIN),
    ).rejects.toMatchObject({
      code: FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND.code,
    });
    expect(readStatistics).not.toHaveBeenCalled();
  });
});
