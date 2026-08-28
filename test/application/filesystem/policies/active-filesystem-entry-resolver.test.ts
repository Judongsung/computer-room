import { describe, expect, it } from "vitest";
import { ActiveFilesystemEntryResolver } from "@/application/filesystem/policies/active-filesystem-entry-resolver";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { MemoryFileRepository } from "@test/support/filesystem/memory-filesystem-repository";

const CREATED_AT = Date.parse("2026-08-28T00:00:00.000Z");

describe("ActiveFilesystemEntryResolver", () => {
  it("returns entries in the desktop and documents trees", async () => {
    const repository = new MemoryFileRepository();
    await repository.insertDirectory({
      id: "active-directory",
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "활성 폴더",
      nameKey: filesystemNameKey("활성 폴더"),
      createdAt: CREATED_AT,
    });

    const resolver = new ActiveFilesystemEntryResolver(repository);

    await expect(resolver.find("active-directory")).resolves.toMatchObject({
      id: "active-directory",
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
    });
  });

  it("preserves separate not-found and inactive errors", async () => {
    const repository = new MemoryFileRepository();
    await repository.insertDirectory({
      id: "inactive-directory",
      parentId: FILESYSTEM_ROOT_ID.RECYCLE_BIN,
      name: "휴지통 폴더",
      nameKey: filesystemNameKey("휴지통 폴더"),
      createdAt: CREATED_AT,
    });
    const resolver = new ActiveFilesystemEntryResolver(repository);
    const errors = {
      notFound: FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND,
      inactive: FILESYSTEM_ERRORS.INVALID_PARENT,
    };

    await expect(
      resolver.requireDirectory("missing", errors),
    ).rejects.toMatchObject({ code: FILESYSTEM_ERRORS.DIRECTORY_NOT_FOUND.code });
    await expect(
      resolver.requireDirectory("inactive-directory", errors),
    ).rejects.toMatchObject({ code: FILESYSTEM_ERRORS.INVALID_PARENT.code });
  });
});
