import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GUEST_PUBLICATION_STATE } from "@/constants/admin/guest-access";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";

import type {
  GuestAccessDirectoryPage,
  GuestAccessSettings,
} from "@/types/admin/guest-access";
import { AdminApplication } from "@client/components/widgets/admin-application";
import { GUEST_ACCESS_COPY } from "@client/content/ko/admin/guest-access";
import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import { XP_EXPLORER_HEADER_CLASS_NAME } from "@client/constants/filesystem/explorer-header";
import type { GuestAccessGateway } from "@client/types/admin/guest-access";

describe("AdminApplication", () => {
  it("updates the master setting while preserving the publication list", async () => {
    const gateway = new FakeGuestAccessGateway();
    const user = userEvent.setup();
    renderAdmin(gateway);

    const toggle = await screen.findByRole("checkbox", {
      name: GUEST_ACCESS_COPY.ENABLE,
    });
    expect(toggle).not.toBeChecked();
    expect(toggle.nextElementSibling).toHaveAttribute("for", toggle.id);
    expect(screen.getByText(GUEST_ACCESS_COPY.NOT_ACTIVE_YET)).toBeInTheDocument();

    await user.click(toggle);
    await waitFor(() =>
      expect(gateway.updateSettings).toHaveBeenCalledWith(true),
    );
    expect(toggle).toBeChecked();
    expect(gateway.items).toHaveLength(2);
  });

  it("shows mixed folders and confirms recursive publication", async () => {
    const gateway = new FakeGuestAccessGateway();
    const user = userEvent.setup();
    renderAdmin(gateway);

    const folderCheckbox = await screen.findByRole("checkbox", {
      name: /사진 부분 공개/,
    });
    expect(folderCheckbox).toBePartiallyChecked();
    expect(folderCheckbox.nextElementSibling).toHaveAttribute(
      "for",
      folderCheckbox.id,
    );
    await user.click(folderCheckbox);

    expect(screen.getByRole("dialog")).toHaveTextContent(
      GUEST_ACCESS_COPY.PUBLISH_DIRECTORY_MESSAGE,
    );
    await user.click(
      screen.getByRole("button", { name: GUEST_ACCESS_COPY.PUBLISH }),
    );
    await waitFor(() =>
      expect(gateway.setEntryPublished).toHaveBeenCalledWith("photos", true),
    );
  });

  it("navigates folders and rolls back a failed file publication", async () => {
    const gateway = new FakeGuestAccessGateway();
    const user = userEvent.setup();
    renderAdmin(gateway);

    const folder = await screen.findByRole("button", { name: "사진" });
    await user.click(folder);
    expect(gateway.setEntryPublished).not.toHaveBeenCalled();
    await user.dblClick(folder);
    await waitFor(() => expect(gateway.listDirectory).toHaveBeenCalledWith("photos"));
    expect(await screen.findByText("inside.png")).toBeInTheDocument();
    const addressBar = screen.getByLabelText(
      XP_EXPLORER_HEADER_COPY.ADDRESS_BAR,
    );
    expect(addressBar).toHaveTextContent("바탕 화면\\사진");
    expect(
      addressBar.querySelector(
        `.${XP_EXPLORER_HEADER_CLASS_NAME.ADDRESS_FIELD}`,
      ),
    ).toBeInTheDocument();

    gateway.setEntryPublished.mockRejectedValueOnce(new Error("저장 실패"));
    const fileCheckbox = screen.getByRole("checkbox", {
      name: /inside.png 비공개/,
    });
    expect(fileCheckbox.nextElementSibling).toHaveAttribute(
      "for",
      fileCheckbox.id,
    );
    await user.click(fileCheckbox);
    expect(await screen.findByRole("alert")).toHaveTextContent("저장 실패");
    expect(fileCheckbox).not.toBeChecked();
  });

  it("appends the next publication page without replacing loaded entries", async () => {
    const gateway = new FakeGuestAccessGateway();
    gateway.nextOffset = 100;
    const user = userEvent.setup();
    renderAdmin(gateway);

    await screen.findByText("readme.txt");
    await user.click(screen.getByRole("button", { name: GUEST_ACCESS_COPY.LOAD_MORE }));

    expect(await screen.findByText("later.txt")).toBeInTheDocument();
    expect(screen.getByText("readme.txt")).toBeInTheDocument();
    expect(gateway.listDirectory).toHaveBeenCalledWith(
      FILESYSTEM_ROOT_ID.DESKTOP,
      100,
    );
  });
});

class FakeGuestAccessGateway implements GuestAccessGateway {
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
  readonly setEntryPublished = vi.fn(async (entryId: string, published: boolean) => ({
    entryId,
    publicationState: published
      ? GUEST_PUBLICATION_STATE.PUBLIC
      : GUEST_PUBLICATION_STATE.PRIVATE,
    affectedCount: 1,
  }));
}

function renderAdmin(guestAccessGateway: GuestAccessGateway): void {
  render(
    <AdminApplication
      windowControls={{
        isActive: true,
        isMaximized: false,
        onFocus: vi.fn(),
        onMinimize: vi.fn(),
        onToggleMaximize: vi.fn(),
        onClose: vi.fn(),
        onSaveFile: vi.fn(),
        canSaveFile: false,
      }}
      guestAccessGateway={guestAccessGateway}
    />,
  );
}

function desktopPage(
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

function photoPage(): GuestAccessDirectoryPage {
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

function desktopFile(): GuestAccessDirectoryPage["items"][number] {
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

function laterFile(): GuestAccessDirectoryPage["items"][number] {
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
