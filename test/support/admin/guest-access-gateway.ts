import { vi } from "vitest";
import { GUEST_PUBLICATION_STATE } from "@/constants/admin/guest-access";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID, FILESYSTEM_ROOT_NAME } from "@/constants/filesystem/filesystem";
import type { GuestAccessDirectoryPage, GuestAccessSettings, GuestPublicationMutationResult } from "@/types/admin/guest-access";
import type { GuestAccessGateway } from "@client/types/admin/guest-access";

export class FakeGuestAccessGateway implements GuestAccessGateway {
  settings: GuestAccessSettings = { enabled: false };
  nextOffset: number | null = null;
  readonly items = [desktopFolder(), desktopFile()];
  readonly getSettings = vi.fn(async () => ({ ...this.settings }));
  readonly updateSettings = vi.fn(async (enabled: boolean) => {
    this.settings = { enabled };
    return { ...this.settings };
  });
  readonly listDirectory = vi.fn(
    async (directoryId: string, offset = 0): Promise<GuestAccessDirectoryPage> => {
      if (directoryId === "photos") return photoPage();
      if (offset === 100) return desktopPage([laterFile()], null);
      return desktopPage(this.items, this.nextOffset);
    },
  );
  readonly setEntryPublished = vi.fn(async (entryId: string, published: boolean): Promise<GuestPublicationMutationResult> => ({
    entryId,
    publicationState: published
      ? GUEST_PUBLICATION_STATE.PUBLIC
      : GUEST_PUBLICATION_STATE.PRIVATE,
    affectedCount: 1,
  }));
}

export function desktopPage(
  items: GuestAccessDirectoryPage["items"],
  nextOffset: number | null = null,
): GuestAccessDirectoryPage {
  return {
    directory: rootDirectory(
      FILESYSTEM_ROOT_ID.DESKTOP,
      FILESYSTEM_ROOT_NAME.DESKTOP,
    ),
    breadcrumbs: [
      { id: FILESYSTEM_ROOT_ID.DESKTOP, name: FILESYSTEM_ROOT_NAME.DESKTOP },
    ],
    items,
    nextOffset,
    sort: { field: "name", direction: "ascending" },
  };
}

export function photoPage(): GuestAccessDirectoryPage {
  return {
    directory: {
      ...rootDirectory("photos", "사진"),
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
    },
    breadcrumbs: [
      { id: FILESYSTEM_ROOT_ID.DESKTOP, name: FILESYSTEM_ROOT_NAME.DESKTOP },
      { id: "photos", name: "사진" },
    ],
    items: [
      {
        entry: {
          id: "inside",
          parentId: "photos",
          kind: FILESYSTEM_ENTRY_KIND.FILE,
          name: "inside.png",
          contentType: "image/png",
          size: 4,
          createdAt: "2026-08-31T00:00:00.000Z",
          updatedAt: "2026-08-31T00:00:00.000Z",
          desktopOrder: null,
        },
        publicationState: GUEST_PUBLICATION_STATE.PRIVATE,
      },
    ],
    nextOffset: null,
    sort: { field: "name", direction: "ascending" },
  };
}

function desktopFolder(): GuestAccessDirectoryPage["items"][number] {
  return {
    entry: {
      ...rootDirectory("photos", "사진"),
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      desktopOrder: 0,
    },
    publicationState: GUEST_PUBLICATION_STATE.PARTIAL,
  };
}

export function desktopFile(): GuestAccessDirectoryPage["items"][number] {
  return {
    entry: {
      id: "readme",
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      name: "readme.txt",
      contentType: "text/plain",
      size: 4,
      createdAt: "2026-08-31T00:00:00.000Z",
      updatedAt: "2026-08-31T00:00:00.000Z",
      desktopOrder: 1,
    },
    publicationState: GUEST_PUBLICATION_STATE.PRIVATE,
  };
}

export function laterFile(): GuestAccessDirectoryPage["items"][number] {
  return {
    ...desktopFile(),
    entry: {
      ...desktopFile().entry,
      id: "later",
      name: "later.txt",
      desktopOrder: 2,
    },
  };
}

function rootDirectory(id: string, name: string) {
  return {
    id,
    parentId: null,
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    desktopOrder: null,
  } as const;
}
