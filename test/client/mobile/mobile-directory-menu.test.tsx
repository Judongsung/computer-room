import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { FILESYSTEM_SORT_COPY } from "@client/content/ko/filesystem/sort";
import { FOLDER_PROPERTIES_COPY } from "@client/content/ko/filesystem/details";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import {
  DEFAULT_FILESYSTEM_DIRECTORY_SORT,
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_FIELD,
} from "@/constants/filesystem/sort";
import type {
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
} from "@/types/filesystem/filesystem";
import type { FilesystemDirectoryDetails } from "@/types/filesystem/directory-details";
import { MobileDirectory } from "@client/components/mobile/filesystem/mobile-directory";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";
import type { FilesystemContentGateway } from "@client/types/filesystem/ports/transfer";

type DirectoryGateway = FilesystemDirectoryGateway &
  Pick<FilesystemContentGateway, "thumbnailUrl">;

describe("mobile directory menu", () => {
  it("shows details for the current folder and refreshes them", async () => {
    const details = directoryDetails();
    const getDirectoryDetails = vi.fn(async () => details);
    const gateway = directoryGateway({ getDirectoryDetails });
    const user = userEvent.setup();
    render(<DirectoryHarness gateway={gateway} />);

    await user.click(
      await screen.findByRole("button", { name: MOBILE_COPY.DETAILS }),
    );
    expect(
      await screen.findByRole("dialog", {
        name: FOLDER_PROPERTIES_COPY.TITLE(details.directory.name),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        FOLDER_PROPERTIES_COPY.CONTAINS_VALUE("2", "1", "1"),
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: FOLDER_PROPERTIES_COPY.REFRESH }),
    );
    await waitFor(() => expect(getDirectoryDetails).toHaveBeenCalledTimes(2));
    await user.click(
      screen.getByRole("button", { name: FOLDER_PROPERTIES_COPY.CLOSE }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("saves the selected sort and reloads the directory from the first page", async () => {
    let storedSort: FilesystemDirectorySort = DEFAULT_FILESYSTEM_DIRECTORY_SORT;
    const listDirectory = vi.fn(async () => directoryPage(storedSort));
    const updateDirectorySort = vi.fn(
      async (_directoryId: string, sort: FilesystemDirectorySort) => {
        storedSort = sort;
        return sort;
      },
    );
    const gateway = directoryGateway({
      listDirectory,
      updateDirectorySort,
    });
    const user = userEvent.setup();
    render(<DirectoryHarness gateway={gateway} />);

    await user.click(
      await screen.findByRole("button", { name: MOBILE_COPY.SORT }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: FILESYSTEM_SORT_COPY.FIELD_LABEL,
      }),
      FILESYSTEM_SORT_FIELD.UPDATED_AT,
    );
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: FILESYSTEM_SORT_COPY.DIRECTION_LABEL,
      }),
      FILESYSTEM_SORT_DIRECTION.DESCENDING,
    );
    await user.click(
      screen.getByRole("button", { name: MOBILE_COPY.APPLY }),
    );

    await waitFor(() =>
      expect(updateDirectorySort).toHaveBeenCalledWith(
        FILESYSTEM_ROOT_ID.DOCUMENTS,
        {
          field: FILESYSTEM_SORT_FIELD.UPDATED_AT,
          direction: FILESYSTEM_SORT_DIRECTION.DESCENDING,
        },
      ),
    );
    await waitFor(() => expect(listDirectory).toHaveBeenCalledTimes(2));
    expect(listDirectory).toHaveBeenLastCalledWith(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      0,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the sort dialog open when saving fails", async () => {
    const message = "정렬을 저장할 수 없습니다.";
    const gateway = directoryGateway({
      updateDirectorySort: vi.fn(async () => {
        throw new Error(message);
      }),
    });
    const user = userEvent.setup();
    render(<DirectoryHarness gateway={gateway} />);

    await user.click(
      await screen.findByRole("button", { name: MOBILE_COPY.SORT }),
    );
    await user.click(
      screen.getByRole("button", { name: MOBILE_COPY.APPLY }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(
      screen.getByRole("dialog", { name: MOBILE_COPY.SORT_TITLE("내 문서") }),
    ).toBeInTheDocument();
  });
});

function DirectoryHarness({ gateway }: { readonly gateway: DirectoryGateway }) {
  const [revision, setRevision] = useState(0);
  const [menuOpen, setMenuOpen] = useState(true);
  return (
    <MobileDirectory
      directoryId={FILESYSTEM_ROOT_ID.DOCUMENTS}
      title="내 문서"
      revision={revision}
      menuOpen={menuOpen}
      gateway={gateway}
      onCloseMenu={() => setMenuOpen(false)}
      onRefresh={() => setRevision((current) => current + 1)}
      onOpenDirectory={vi.fn()}
      onOpenEntry={vi.fn()}
      onSearch={vi.fn()}
    />
  );
}

function directoryGateway(
  overrides: Partial<DirectoryGateway> = {},
): DirectoryGateway {
  return {
    listDirectory: vi.fn(async () =>
      directoryPage(DEFAULT_FILESYSTEM_DIRECTORY_SORT),
    ),
    updateDirectorySort: vi.fn(async (_directoryId, sort) => sort),
    getDirectoryDetails: vi.fn(async () => directoryDetails()),
    thumbnailUrl: (id: string) => `/thumbnail/${id}`,
    ...overrides,
  };
}

function directoryPage(
  sort: FilesystemDirectorySort,
): FilesystemDirectoryPage {
  return {
    directory: directoryDetails().directory,
    breadcrumbs: [{ id: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "내 문서" }],
    items: [],
    nextOffset: null,
    sort,
  };
}

function directoryDetails(): FilesystemDirectoryDetails {
  return {
    directory: {
      id: FILESYSTEM_ROOT_ID.DOCUMENTS,
      parentId: null,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name: "내 문서",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(1_000).toISOString(),
      desktopOrder: null,
    },
    breadcrumbs: [{ id: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "내 문서" }],
    totalBytes: 2_048,
    fileCount: 2,
    directoryCount: 1,
    widgetCount: 1,
  };
}
