import { describe, expect, it } from "vitest";
import { FilesystemNameAllocator } from "@/application/filesystem/policies/filesystem-name-allocator";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { MemoryFileRepository } from "@test/support/filesystem/memory-filesystem-repository";

const CREATED_AT = Date.parse("2026-08-28T00:00:00.000Z");

describe("FilesystemNameAllocator", () => {
  it("normalizes a name and allocates the next extension-aware suffix", async () => {
    const repository = new MemoryFileRepository();
    await repository.insertDirectory({
      id: "existing",
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "image.png",
      nameKey: filesystemNameKey("image.png"),
      createdAt: CREATED_AT,
    });
    const allocator = new FilesystemNameAllocator(repository);

    await expect(
      allocator.allocate(FILESYSTEM_ROOT_ID.DOCUMENTS, "  IMAGE.png  "),
    ).resolves.toBe("IMAGE (2).png");
  });

  it("excludes the entry being renamed from collision checks", async () => {
    const repository = new MemoryFileRepository();
    await repository.insertDirectory({
      id: "current",
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "사진",
      nameKey: filesystemNameKey("사진"),
      createdAt: CREATED_AT,
    });
    const allocator = new FilesystemNameAllocator(repository);

    await expect(
      allocator.allocate(FILESYSTEM_ROOT_ID.DOCUMENTS, "사진", "current"),
    ).resolves.toBe("사진");
  });
});
