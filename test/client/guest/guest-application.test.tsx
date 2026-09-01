import type { CSSProperties, ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "@client/app";
import { CLIENT_ACCESS_MODE } from "@client/constants/platform/access";
import { CLIENT_INTERFACE_MODE } from "@client/constants/shared/interface-mode";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { DASHBOARD_COPY } from "@client/content/ko/widgets/content";
import { PROJECT_EXTERNAL_LINKS } from "@client/constants/platform/external-links";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemEntry,
  FilesystemWidgetEntry,
} from "@/types/filesystem/filesystem";
import type { GuestProgramDocument } from "@/types/guest/guest";
import type { GuestGateway } from "@client/types/guest/guest";

vi.mock("react-rnd", () => ({
  Rnd: ({ children, style }: { readonly children: ReactNode; readonly style?: CSSProperties }) => (
    <div data-testid="desktop-window" style={style}>{children}</div>
  ),
}));

describe("guest application", () => {
  it("shows only public desktop entries and opens read-only desktop windows", async () => {
    const gateway = new FakeGuestGateway();
    const user = userEvent.setup();
    render(
      <App
        guestApi={gateway}
        accessMode={CLIENT_ACCESS_MODE.GUEST}
        interfaceMode={CLIENT_INTERFACE_MODE.DESKTOP}
      />,
    );

    expect(await screen.findByRole("button", { name: GUEST_COPY.MY_DOCUMENTS })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: MOBILE_COPY.MY_COMPUTER })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: MOBILE_COPY.RECYCLE_BIN })).not.toBeInTheDocument();

    await user.dblClick(await screen.findByRole("button", { name: "공개 폴더" }));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "공개 폴더" }).length).toBeGreaterThan(1),
    );
    await user.dblClick(screen.getByRole("button", { name: "공개 메모" }));
    expect(await screen.findByRole("heading", { name: "공개 내용" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "편집" })).not.toBeInTheDocument();
  });

  it("uses the Android home and navigation stack for mobile guests", async () => {
    const gateway = new FakeGuestGateway();
    const user = userEvent.setup();
    render(
      <App
        guestApi={gateway}
        accessMode={CLIENT_ACCESS_MODE.GUEST}
        interfaceMode={CLIENT_INTERFACE_MODE.MOBILE}
      />,
    );

    const documents = await screen.findByRole("button", { name: GUEST_COPY.MY_DOCUMENTS });
    expect(screen.queryByRole("button", { name: MOBILE_COPY.MY_COMPUTER })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: MOBILE_COPY.RECYCLE_BIN })).not.toBeInTheDocument();
    await user.click(documents);
    expect(await screen.findByRole("heading", { name: FILESYSTEM_ROOT_NAME.DOCUMENTS })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: MOBILE_COPY.HOME }));
    await user.click(await screen.findByRole("button", { name: "공개 메모" }));
    expect(await screen.findByRole("heading", { name: "공개 내용" })).toBeInTheDocument();
  });

  it("shows the project repository in the guest start menu", async () => {
    const user = userEvent.setup();
    render(
      <App
        guestApi={new FakeGuestGateway()}
        accessMode={CLIENT_ACCESS_MODE.GUEST}
        interfaceMode={CLIENT_INTERFACE_MODE.DESKTOP}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: DASHBOARD_COPY.START }),
    );
    const repository = screen.getByRole("link", {
      name: new RegExp(DASHBOARD_COPY.GITHUB_REPOSITORY),
    });
    expect(repository).toHaveAttribute(
      "href",
      PROJECT_EXTERNAL_LINKS.GITHUB_REPOSITORY,
    );
    expect(repository).toHaveAttribute("target", "_blank");

    await user.click(repository);
    expect(
      screen.queryByRole("link", {
        name: new RegExp(DASHBOARD_COPY.GITHUB_REPOSITORY),
      }),
    ).not.toBeInTheDocument();
  });
});

class FakeGuestGateway implements GuestGateway {
  private readonly folder = directory("public-folder", FILESYSTEM_ROOT_ID.DESKTOP, "공개 폴더");
  private readonly memo: FilesystemWidgetEntry = {
    id: "public-memo-entry",
    parentId: FILESYSTEM_ROOT_ID.DESKTOP,
    kind: FILESYSTEM_ENTRY_KIND.WIDGET,
    name: "공개 메모",
    widgetId: "public-memo-widget",
    widgetType: WIDGET_TYPE.MEMO,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    desktopOrder: 1,
  };

  async getSession() {
    return { enabled: true, loginUrl: "/auth/login" } as const;
  }

  async listDirectory(directoryId: string): Promise<FilesystemDirectoryPage> {
    if (directoryId === FILESYSTEM_ROOT_ID.DESKTOP) {
      return page(
        directory(FILESYSTEM_ROOT_ID.DESKTOP, null, FILESYSTEM_ROOT_NAME.DESKTOP),
        [this.folder, this.memo],
      );
    }
    if (directoryId === FILESYSTEM_ROOT_ID.DOCUMENTS) {
      return page(
        directory(FILESYSTEM_ROOT_ID.DOCUMENTS, null, FILESYSTEM_ROOT_NAME.DOCUMENTS),
        [],
      );
    }
    return page(this.folder, []);
  }

  async getProgramDocument(): Promise<GuestProgramDocument> {
    return {
      entry: this.memo,
      type: WIDGET_TYPE.MEMO,
      data: { markdown: "# 공개 내용", updatedAt: null },
    };
  }

  downloadUrl(id: string): string { return `/api/guest/files/${id}/download`; }
  contentUrl(id: string): string { return `/api/guest/files/${id}/content`; }
  thumbnailUrl(id: string): string { return `/api/guest/files/${id}/thumbnail`; }
}

function directory(
  id: string,
  parentId: string | null,
  name: string,
): FilesystemDirectoryEntry {
  return {
    id,
    parentId,
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    desktopOrder: null,
  };
}

function page(
  root: FilesystemDirectoryEntry,
  items: readonly FilesystemEntry[],
): FilesystemDirectoryPage {
  return {
    directory: root,
    breadcrumbs: [{ id: root.id, name: root.name }],
    items,
    nextOffset: null,
    sort: DEFAULT_FILESYSTEM_DIRECTORY_SORT,
  };
}
