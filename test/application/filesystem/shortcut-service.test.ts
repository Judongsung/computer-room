import { describe, expect, it } from "vitest";
import { FilesystemShortcutService } from "@/application/filesystem/entries/filesystem-shortcut-service";
import { FilesystemDownloadManifestService } from "@/application/filesystem/filesystem-download-manifest-service";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { MemoryFileRepository } from "@test/support/filesystem/memory-filesystem-repository";
import { filesystemEntryRecord } from "@test/support/filesystem/filesystem-entry-record";
import { SequenceIdGenerator, StaticClock } from "@test/support/platform/runtime-fakes";

function setup() {
  const repository = new MemoryFileRepository();
  const service = new FilesystemShortcutService(repository, new SequenceIdGenerator(["link", "link2"]), new StaticClock(100));
  const target = filesystemEntryRecord("target", "file", "original.txt");
  repository.records.set(target.id, target);
  const create = () => service.createShortcut({ targetEntryId: target.id, parentId: FILESYSTEM_ROOT_ID.DESKTOP, name: "My shortcut" });
  return { repository, service, target, create };
}

describe("filesystem shortcuts", () => {
  it.each(["file", "directory", "memo", "daily-checklist"] as const)("opens a %s target without copying its data", async (kind) => {
    const { repository, service, target, create } = setup();
    repository.records.set(target.id, { ...target,
      kind: kind === "memo" || kind === "daily-checklist" ? "widget" : kind,
      widgetId: "program", widgetType: kind === "memo" || kind === "daily-checklist" ? kind : null,
    });
    const link = await create();
    expect(link).toMatchObject({ kind: "shortcut", targetEntryId: target.id, desktopOrder: 0 });
    expect(repository.records.get(link.id)).toMatchObject({ fileId: null, widgetId: null, objectKey: null });
    expect(await service.resolveShortcut(link.id)).toMatchObject({ id: target.id, name: target.name });
  });

  it("keeps its own name across target rename/move and recovers after target restoration", async () => {
    const { repository, service, target, create } = setup();
    const link = await create();
    repository.records.set(target.id, { ...target, name: "renamed", parentId: FILESYSTEM_ROOT_ID.DESKTOP });
    expect(await service.resolveShortcut(link.id)).toMatchObject({ id: target.id, name: "renamed" });
    expect(repository.records.get(link.id)?.name).toBe("My shortcut");
    repository.records.set(target.id, { ...target, parentId: FILESYSTEM_ROOT_ID.RECYCLE_BIN, trashedAt: 1 });
    await expect(service.resolveShortcut(link.id)).rejects.toMatchObject({ code: "FILESYSTEM_SHORTCUT_TARGET_UNAVAILABLE" });
    repository.records.set(target.id, target);
    expect((await service.resolveShortcut(link.id)).id).toBe(target.id);
    repository.records.delete(target.id);
    await expect(service.resolveShortcut(link.id)).rejects.toMatchObject({ code: "FILESYSTEM_SHORTCUT_TARGET_UNAVAILABLE" });
    expect(repository.records.has(link.id)).toBe(true);
  });

  it("rejects chains and system roots and allocates independent duplicate names", async () => {
    const { service, create } = setup();
    const first = await create();
    expect((await create()).name).not.toBe(first.name);
    for (const targetEntryId of [first.id, FILESYSTEM_ROOT_ID.DESKTOP]) {
      await expect(service.createShortcut({ targetEntryId, parentId: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "bad" }))
        .rejects.toMatchObject({ code: "FILESYSTEM_INVALID_SHORTCUT_TARGET" });
    }
  });

  it("does not traverse shortcuts during download or delete their targets", async () => {
    const { repository, target, create } = setup();
    const link = await create();
    const manifest = await new FilesystemDownloadManifestService(repository).createManifest([link.id]);
    expect(manifest).toMatchObject({ entries: [], totalBytes: 0, skippedShortcutIds: [link.id] });
    await repository.purgeEntry(link.id);
    expect(repository.records.get(target.id)).toEqual(target);
  });
});
