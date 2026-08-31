import { describe, expect, it } from "vitest";
import { GuestAccessService } from "@/application/admin/guest-access-service";
import { FilesystemDirectoryService } from "@/application/filesystem/directory/filesystem-directory-service";
import { ActiveFilesystemEntryResolver } from "@/application/filesystem/policies/active-filesystem-entry-resolver";
import {
  GUEST_PUBLICATION_STATE,
} from "@/constants/admin/guest-access";
import { GUEST_ACCESS_ERRORS } from "@/constants/admin/errors/guest-access";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type {
  GuestAccessSettings,
  GuestPublicationState,
} from "@/types/admin/guest-access";
import type { GuestAccessRepository } from "@/types/admin/guest-access-repository";
import {
  MemoryDirectorySortRepository,
  MemoryFileRepository,
} from "@test/support/filesystem/memory-filesystem-repository";
import {
  SequenceIdGenerator,
  StaticClock,
} from "@test/support/platform/runtime-fakes";

const NOW = 1_800_000_000_000;

describe("GuestAccessService", () => {
  it("preserves publication choices while the master setting changes", async () => {
    const { guestAccess, service } = createService();
    guestAccess.states.set("published", GUEST_PUBLICATION_STATE.PUBLIC);

    await expect(service.getSettings()).resolves.toEqual({ enabled: false });
    await expect(service.updateSettings(true)).resolves.toEqual({ enabled: true });
    await expect(service.updateSettings(false)).resolves.toEqual({ enabled: false });
    expect(guestAccess.states.get("published")).toBe(
      GUEST_PUBLICATION_STATE.PUBLIC,
    );
  });

  it("combines a directory page with stored publication states", async () => {
    const { entries, guestAccess, service } = createService();
    await entries.insertDirectory({
      id: "folder",
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "Folder",
      nameKey: "folder",
      createdAt: NOW,
    });
    await entries.insertPendingFile({
      entry: {
        id: "file",
        parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
        name: "file.png",
        nameKey: "file.png",
        createdAt: NOW,
      },
      objectKey: "files/file",
      contentType: "image/png",
      size: 4,
    });
    await entries.markFileReady("file", 4, "etag");
    guestAccess.states.set("folder", GUEST_PUBLICATION_STATE.PARTIAL);

    const page = await service.listDirectory(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      0,
      100,
    );

    expect(page.items).toEqual([
      expect.objectContaining({
        entry: expect.objectContaining({ id: "folder" }),
        publicationState: GUEST_PUBLICATION_STATE.PARTIAL,
      }),
      expect.objectContaining({
        entry: expect.objectContaining({ id: "file" }),
        publicationState: GUEST_PUBLICATION_STATE.PRIVATE,
      }),
    ]);
  });

  it("publishes files directly and directories recursively at the current time", async () => {
    const { entries, guestAccess, service } = createService();
    await entries.insertDirectory({
      id: "folder",
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "Folder",
      nameKey: "folder",
      createdAt: NOW,
    });
    await entries.insertPendingFile({
      entry: {
        id: "file",
        parentId: "folder",
        name: "file.png",
        nameKey: "file.png",
        createdAt: NOW,
      },
      objectKey: "files/file",
      contentType: "image/png",
      size: 4,
    });
    await entries.markFileReady("file", 4, "etag");

    await expect(service.setEntryPublished("file", true)).resolves.toEqual({
      entryId: "file",
      publicationState: GUEST_PUBLICATION_STATE.PUBLIC,
      affectedCount: 1,
    });
    await service.setEntryPublished("folder", false);

    expect(guestAccess.mutations).toEqual([
      { entryId: "file", recursive: false, published: true, publishedAt: NOW },
      { entryId: "folder", recursive: true, published: false, publishedAt: NOW },
    ]);
  });

  it("rejects system roots, inactive entries, and unsupported program documents", async () => {
    const { entries, service } = createService();
    await entries.insertWidget({
      id: "unsupported-program-document",
      widgetId: "storage-program",
      widgetType: WIDGET_TYPE.STORAGE_STATUS,
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "Storage",
      nameKey: "storage",
      createdAt: NOW,
    });
    await entries.insertDirectory({
      id: "trashed-folder",
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: "Trashed",
      nameKey: "trashed",
      createdAt: NOW,
    });
    await entries.moveToTrash(
      "trashed-folder",
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "내 문서\\Trashed",
      NOW,
    );

    await expect(
      service.setEntryPublished(FILESYSTEM_ROOT_ID.DOCUMENTS, true),
    ).rejects.toMatchObject({
      code: GUEST_ACCESS_ERRORS.SYSTEM_ROOT_NOT_PUBLISHABLE.code,
    });
    await expect(
      service.setEntryPublished("trashed-folder", true),
    ).rejects.toMatchObject({ code: GUEST_ACCESS_ERRORS.ENTRY_NOT_ACTIVE.code });
    await expect(
      service.setEntryPublished("unsupported-program-document", true),
    ).rejects.toMatchObject({
      code: GUEST_ACCESS_ERRORS.ENTRY_TYPE_NOT_SUPPORTED.code,
    });
  });
});

class MemoryGuestAccessRepository implements GuestAccessRepository {
  settings: GuestAccessSettings = { enabled: false };
  readonly states = new Map<string, GuestPublicationState>();
  readonly mutations: Array<{
    readonly entryId: string;
    readonly recursive: boolean;
    readonly published: boolean;
    readonly publishedAt: number;
  }> = [];

  async getSettings(): Promise<GuestAccessSettings> {
    return { ...this.settings };
  }

  async saveSettings(enabled: boolean): Promise<GuestAccessSettings> {
    this.settings = { enabled };
    return { ...this.settings };
  }

  async findPublicationStates(
    entryIds: readonly string[],
  ): Promise<ReadonlyMap<string, GuestPublicationState>> {
    return new Map(
      entryIds.flatMap((id) => {
        const state = this.states.get(id);
        return state ? [[id, state] as const] : [];
      }),
    );
  }

  async setEntryPublished(
    entryId: string,
    recursive: boolean,
    published: boolean,
    publishedAt: number,
  ): Promise<number> {
    this.mutations.push({ entryId, recursive, published, publishedAt });
    this.states.set(
      entryId,
      published
        ? GUEST_PUBLICATION_STATE.PUBLIC
        : GUEST_PUBLICATION_STATE.PRIVATE,
    );
    return 1;
  }
}

function createService() {
  const entries = new MemoryFileRepository();
  const activeEntries = new ActiveFilesystemEntryResolver(entries);
  const guestAccess = new MemoryGuestAccessRepository();
  const directories = new FilesystemDirectoryService(
    entries,
    new MemoryDirectorySortRepository(),
    new SequenceIdGenerator(["unused"]),
    new StaticClock(NOW),
    activeEntries,
  );
  return {
    entries,
    guestAccess,
    service: new GuestAccessService(
      guestAccess,
      directories,
      activeEntries,
      new StaticClock(NOW),
    ),
  };
}
