import { STORAGE_STATUS_COPY } from "@client/content/ko/storage/storage-status";
import { MEDIA_VIEWER_COPY } from "@client/content/ko/media/media";
import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import {
  FILESYSTEM_SORT_DIRECTION_LABELS,
  FILESYSTEM_SORT_FIELD_OPTIONS,
} from "@client/content/ko/filesystem/sort";
import { FOLDER_PROPERTIES_COPY } from "@client/content/ko/filesystem/details";
import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@client/app";
import {
  CHECKLIST_WIDGET_COPY,
  DASHBOARD_COPY,
  MEMO_WIDGET_COPY,
} from "@client/content/ko/widgets/content";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import { ACCESS_LOGOUT_PATH } from "@/constants/platform/auth";
import { CHECKLIST_EVENT_ACTION } from "@/constants/widgets/checklist";
import { MAX_FILE_SIZE_BYTES } from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import {
  DEFAULT_FILESYSTEM_DIRECTORY_SORT,
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_FIELD,
} from "@/constants/filesystem/sort";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import { cloneDashboardWidgets } from "@/domain/widgets/widget-data";
import type { SessionInfo } from "@/types/platform/auth";
import type {
  ChecklistItem,
  ChecklistLogEvent,
  ChecklistLogPage,
  DailyChecklistData,
  DashboardWidget,
  CreateWidgetInput,
  MemoData,
  WidgetLayout,
} from "@/types/widgets/widget";
import type {
  FilesystemDirectoryEntry,
  FilesystemDirectoryPage,
  FilesystemDirectorySort,
  FilesystemEntry,
  FilesystemFileEntry,
  FilesystemTrashPage,
  FilesystemWidgetEntry,
  MoveFilesystemEntryInput,
  SaveWidgetFileInput,
  UpdateFilesystemEntryInput,
} from "@/types/filesystem/filesystem";
import type { FilesystemBatchResult } from "@/types/filesystem/batch";
import type { FilesystemDirectoryDetails } from "@/types/filesystem/directory-details";
import type { FilesystemDownloadManifest } from "@/types/filesystem/download";
import type { StorageStatusSnapshot } from "@/types/storage/storage-status";

vi.mock("react-rnd", () => ({
  Rnd: ({ children }: { readonly children: ReactNode }) => (
    <div data-testid="desktop-window">{children}</div>
  ),
}));
import { SESSION } from "@test/support/desktop/app-test-session";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import {
  checklistWidget,
  desktopWindowByTitle,
  desktopWindowTitles,
  emptyStorageStatusSnapshot,
  memoWidget,
  openStartMenu,
} from "@test/client/support/desktop/app-integration-helpers";

describe("App desktop filesystem", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("remembers sort settings independently for each explorer folder", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DOCUMENTS, "사진");
    const updateSort = vi.spyOn(filesystem, "updateDirectorySort");
    const listDirectory = vi.spyOn(filesystem, "listDirectory");
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    let documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
    await user.click(
      within(documentsWindow).getByRole("menuitem", {
        name: XP_EXPLORER_HEADER_COPY.VIEW_MENU,
      }),
    );
    let viewMenu = screen.getByRole("menu", {
      name: XP_EXPLORER_HEADER_COPY.VIEW_MENU,
    });
    const createdAtLabel = FILESYSTEM_SORT_FIELD_OPTIONS.find(
      ({ value }) => value === FILESYSTEM_SORT_FIELD.CREATED_AT,
    )!.label;
    await user.click(
      within(viewMenu).getByRole("menuitemradio", { name: createdAtLabel }),
    );
    await waitFor(() =>
      expect(updateSort).toHaveBeenLastCalledWith(FILESYSTEM_ROOT_ID.DOCUMENTS, {
        field: FILESYSTEM_SORT_FIELD.CREATED_AT,
        direction: FILESYSTEM_SORT_DIRECTION.ASCENDING,
      }),
    );
    await waitFor(() => expect(listDirectory.mock.calls.length).toBeGreaterThan(1));

    documentsWindow = desktopWindowByTitle("내 문서");
    await user.click(
      within(documentsWindow).getByRole("menuitem", {
        name: XP_EXPLORER_HEADER_COPY.VIEW_MENU,
      }),
    );
    viewMenu = screen.getByRole("menu", {
      name: XP_EXPLORER_HEADER_COPY.VIEW_MENU,
    });
    expect(
      within(viewMenu).getByRole("menuitemradio", { name: createdAtLabel }),
    ).toHaveAttribute("aria-checked", "true");
    const newestFirst =
      FILESYSTEM_SORT_DIRECTION_LABELS[FILESYSTEM_SORT_FIELD.CREATED_AT][
        FILESYSTEM_SORT_DIRECTION.DESCENDING
      ];
    await user.click(
      within(viewMenu).getByRole("menuitemradio", { name: newestFirst }),
    );
    await waitFor(() =>
      expect(updateSort).toHaveBeenLastCalledWith(FILESYSTEM_ROOT_ID.DOCUMENTS, {
        field: FILESYSTEM_SORT_FIELD.CREATED_AT,
        direction: FILESYSTEM_SORT_DIRECTION.DESCENDING,
      }),
    );
    await waitFor(() => expect(listDirectory.mock.calls.length).toBeGreaterThan(2));

    await user.dblClick(
      within(documentsWindow).getByRole("button", { name: "사진" }),
    );
    documentsWindow = await waitFor(() => desktopWindowByTitle("사진"));
    await user.click(
      within(documentsWindow).getByRole("menuitem", {
        name: XP_EXPLORER_HEADER_COPY.VIEW_MENU,
      }),
    );
    viewMenu = screen.getByRole("menu", {
      name: XP_EXPLORER_HEADER_COPY.VIEW_MENU,
    });
    const nameLabel = FILESYSTEM_SORT_FIELD_OPTIONS.find(
      ({ value }) => value === FILESYSTEM_SORT_FIELD.NAME,
    )!.label;
    expect(
      within(viewMenu).getByRole("menuitemradio", { name: nameLabel }),
    ).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Escape}");

    await user.click(
      within(documentsWindow).getByRole("button", { name: FILESYSTEM_COPY.BACK }),
    );
    documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
    await user.click(
      within(documentsWindow).getByRole("menuitem", {
        name: XP_EXPLORER_HEADER_COPY.VIEW_MENU,
      }),
    );
    viewMenu = screen.getByRole("menu", {
      name: XP_EXPLORER_HEADER_COPY.VIEW_MENU,
    });
    expect(
      within(viewMenu).getByRole("menuitemradio", { name: createdAtLabel }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      within(viewMenu).getByRole("menuitemradio", { name: newestFirst }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("keeps a desktop folder selected and opens other folders in independent windows", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "사진");
    await filesystem.createDirectory(FILESYSTEM_ROOT_ID.DESKTOP, "음악");
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    const documentsShortcut = await screen.findByRole("button", {
      name: "내 문서",
    });
    const picturesShortcut = await screen.findByRole("button", { name: "사진" });
    await user.dblClick(picturesShortcut);

    expect(picturesShortcut).toHaveAttribute("aria-pressed", "true");
    expect(documentsShortcut).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(desktopWindowTitles()).toContain("사진"));

    await user.dblClick(screen.getByRole("button", { name: "음악" }));

    await waitFor(() => {
      expect(desktopWindowTitles()).toEqual(
        expect.arrayContaining(["사진", "음악"]),
      );
    });
    const taskbar = screen.getByRole("contentinfo", {
      name: DASHBOARD_COPY.TASKBAR,
    });
    expect(within(taskbar).getByRole("button", { name: "사진" })).toBeInTheDocument();
    expect(within(taskbar).getByRole("button", { name: "음악" })).toBeInTheDocument();
  });

  it("shows recursive folder properties from keyboard, Explorer menu, and context menu", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const photos = await filesystem.createDirectory(
      FILESYSTEM_ROOT_ID.DOCUMENTS,
      "사진",
    );
    await filesystem.createDirectory(photos.id, "여행");
    filesystem.addFile("제주.txt", "text/plain", photos.id);
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    const documentsShortcut = await screen.findByRole("button", {
      name: "내 문서",
    });
    fireEvent.keyDown(documentsShortcut, { key: "Enter", altKey: true });
    let dialog = await screen.findByRole("dialog", { name: "내 문서 속성" });
    expect(
      within(dialog).getByText(
        FOLDER_PROPERTIES_COPY.CONTAINS_VALUE("1", "2", "0"),
      ),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", {
        name: FOLDER_PROPERTIES_COPY.CLOSE,
      }),
    );

    await user.dblClick(documentsShortcut);
    const documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
    const photosButton = await within(documentsWindow).findByRole("button", {
      name: "사진",
    });
    await user.click(photosButton);
    fireEvent.keyDown(photosButton, { key: "Enter", altKey: true });
    dialog = await screen.findByRole("dialog", { name: "사진 속성" });
    expect(desktopWindowTitles()).toContain("내 문서");
    expect(desktopWindowTitles()).not.toContain("사진");
    await user.click(
      within(dialog).getByRole("button", {
        name: FOLDER_PROPERTIES_COPY.CLOSE,
      }),
    );

    await user.click(
      within(documentsWindow).getByRole("menuitem", {
        name: XP_EXPLORER_HEADER_COPY.FILE_MENU,
      }),
    );
    await user.click(
      screen.getByRole("menuitem", {
        name: FOLDER_PROPERTIES_COPY.PROPERTIES,
      }),
    );
    dialog = await screen.findByRole("dialog", { name: "사진 속성" });
    expect(within(dialog).getByText("내 문서\\사진")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        FOLDER_PROPERTIES_COPY.CONTAINS_VALUE("1", "1", "0"),
      ),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", {
        name: FOLDER_PROPERTIES_COPY.CLOSE,
      }),
    );

    fireEvent.contextMenu(photosButton);
    await user.click(
      screen.getByRole("menuitem", {
        name: FOLDER_PROPERTIES_COPY.PROPERTIES,
      }),
    );
    expect(
      await screen.findByRole("dialog", { name: "사진 속성" }),
    ).toBeInTheDocument();
  });

  it("creates a folder from My Documents", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
    await user.click(within(documentsWindow).getByRole("button", { name: FILESYSTEM_COPY.NEW_FOLDER }));
    const dialog = screen.getByRole("dialog", { name: FILESYSTEM_COPY.CREATE_FOLDER_TITLE });
    await user.type(within(dialog).getByRole("textbox"), "사진");
    await user.click(within(dialog).getByRole("button", { name: FILESYSTEM_COPY.CONFIRM }));
    expect(await within(documentsWindow).findByText("사진")).toBeInTheDocument();
  });

  it("preserves a multi-selection when an Explorer item opens its XP menu", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    filesystem.addFile("첫째.txt", "text/plain");
    filesystem.addFile("둘째.txt", "text/plain");
    filesystem.addFile("셋째.txt", "text/plain");
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
    const first = await within(documentsWindow).findByRole("button", {
      name: /첫째\.txt/,
    });
    const third = within(documentsWindow).getByRole("button", {
      name: /셋째\.txt/,
    });
    await user.click(first);
    fireEvent.click(third, { ctrlKey: true });

    fireEvent.contextMenu(first);
    expect(
      within(documentsWindow).getByText(FILESYSTEM_COPY.SELECTED_COUNT(2)),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("menuitem", { name: FILESYSTEM_COPY.DELETE }),
    );

    await waitFor(() => {
      expect(within(documentsWindow).queryByRole("button", { name: /첫째\.txt/ })).not.toBeInTheDocument();
      expect(within(documentsWindow).queryByRole("button", { name: /셋째\.txt/ })).not.toBeInTheDocument();
    });
  });

  it("selects filesystem ranges and batches a multi-item delete", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    filesystem.addFile("첫째.txt", "text/plain");
    filesystem.addFile("둘째.txt", "text/plain");
    filesystem.addFile("셋째.txt", "text/plain");
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
    const first = await within(documentsWindow).findByRole("button", {
      name: /첫째\.txt/,
    });
    const second = within(documentsWindow).getByRole("button", {
      name: /둘째\.txt/,
    });
    const third = within(documentsWindow).getByRole("button", {
      name: /셋째\.txt/,
    });

    await user.click(first);
    fireEvent.click(third, { shiftKey: true });
    expect(
      within(documentsWindow).getByText(FILESYSTEM_COPY.SELECTED_COUNT(3)),
    ).toBeInTheDocument();

    fireEvent.keyDown(third, { key: "Escape" });
    expect(
      within(documentsWindow).queryByText(FILESYSTEM_COPY.SELECTED_COUNT(3)),
    ).not.toBeInTheDocument();

    await user.click(second);
    fireEvent.keyDown(second, { key: "a", ctrlKey: true });
    expect(
      within(documentsWindow).getByText(FILESYSTEM_COPY.SELECTED_COUNT(3)),
    ).toBeInTheDocument();
    fireEvent.keyDown(second, { key: "Escape" });

    await user.click(first);
    fireEvent.click(third, { ctrlKey: true });
    expect(
      within(documentsWindow).getByText(FILESYSTEM_COPY.SELECTED_COUNT(2)),
    ).toBeInTheDocument();
    await user.click(
      within(documentsWindow).getByRole("button", {
        name: FILESYSTEM_COPY.DELETE,
      }),
    );

    await waitFor(() => {
      expect(
        within(documentsWindow).queryByRole("button", { name: /첫째\.txt/ }),
      ).not.toBeInTheDocument();
      expect(
        within(documentsWindow).queryByRole("button", { name: /셋째\.txt/ }),
      ).not.toBeInTheDocument();
    });
    expect(
      within(documentsWindow).getByRole("button", { name: /둘째\.txt/ }),
    ).toBeInTheDocument();
  });

  it("opens shortcuts with Enter and synchronizes My Documents with Recycle Bin", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    const documentsShortcut = await screen.findByRole("button", {
      name: "내 문서",
    });
    documentsShortcut.focus();
    await user.keyboard("{Enter}");
    const documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));

    const recycleBinShortcut = screen.getByRole("button", { name: "휴지통" });
    recycleBinShortcut.focus();
    await user.keyboard("{Enter}");
    const recycleBinWindow = await waitFor(() => desktopWindowByTitle("휴지통"));

    await user.click(
      within(documentsWindow).getByRole("button", {
        name: FILESYSTEM_COPY.NEW_FOLDER,
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.CREATE_FOLDER_TITLE,
    });
    await user.type(within(dialog).getByRole("textbox"), "사진");
    await user.click(
      within(dialog).getByRole("button", { name: FILESYSTEM_COPY.CONFIRM }),
    );
    await user.click(
      await within(documentsWindow).findByRole("button", { name: "사진" }),
    );
    await user.click(
      within(documentsWindow).getByRole("button", {
        name: FILESYSTEM_COPY.DELETE,
      }),
    );

    await user.click(
      await within(recycleBinWindow).findByRole("button", { name: /사진/ }),
    );
    await user.click(
      within(recycleBinWindow).getByRole("button", {
        name: FILESYSTEM_COPY.RESTORE,
      }),
    );
    expect(
      await within(documentsWindow).findByRole("button", { name: "사진" }),
    ).toBeInTheDocument();
    expect(
      within(recycleBinWindow).getByText(FILESYSTEM_COPY.EMPTY_TRASH),
    ).toBeInTheDocument();
  });

  it("confirms permanent deletion and emptying the Recycle Bin", async () => {
    const api = new FakeDashboardGateway();
    const filesystem = new FakeFilesystemGateway();
    const user = userEvent.setup();
    render(<App api={api} filesystemApi={filesystem} />);

    await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
    const documentsWindow = await waitFor(() => desktopWindowByTitle("내 문서"));
    await user.click(
      within(documentsWindow).getByRole("button", {
        name: FILESYSTEM_COPY.NEW_FOLDER,
      }),
    );
    const nameDialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.CREATE_FOLDER_TITLE,
    });
    await user.type(within(nameDialog).getByRole("textbox"), "삭제할 폴더");
    await user.click(
      within(nameDialog).getByRole("button", {
        name: FILESYSTEM_COPY.CONFIRM,
      }),
    );
    await user.click(
      await within(documentsWindow).findByRole("button", {
        name: "삭제할 폴더",
      }),
    );
    await user.click(
      within(documentsWindow).getByRole("button", {
        name: FILESYSTEM_COPY.DELETE,
      }),
    );

    await user.dblClick(screen.getByRole("button", { name: "휴지통" }));
    const recycleBinWindow = await waitFor(() => desktopWindowByTitle("휴지통"));
    await user.click(
      await within(recycleBinWindow).findByRole("button", {
        name: /삭제할 폴더/,
      }),
    );
    await user.click(
      within(recycleBinWindow).getByRole("button", {
        name: FILESYSTEM_COPY.PERMANENT_DELETE,
      }),
    );
    const deleteDialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.PERMANENT_DELETE,
    });
    expect(deleteDialog).toHaveTextContent(
      FILESYSTEM_COPY.PERMANENT_DELETE_CONFIRM,
    );
    await user.click(
      within(deleteDialog).getByRole("button", {
        name: FILESYSTEM_COPY.CANCEL,
      }),
    );

    await user.click(
      within(recycleBinWindow).getByRole("button", {
        name: FILESYSTEM_COPY.EMPTY_RECYCLE_BIN,
      }),
    );
    const emptyDialog = screen.getByRole("dialog", {
      name: FILESYSTEM_COPY.EMPTY_RECYCLE_BIN,
    });
    expect(emptyDialog).toHaveTextContent(
      FILESYSTEM_COPY.EMPTY_RECYCLE_BIN_CONFIRM,
    );
    await user.click(
      within(emptyDialog).getByRole("button", {
        name: FILESYSTEM_COPY.CONFIRM,
      }),
    );
    expect(
      await within(recycleBinWindow).findByText(FILESYSTEM_COPY.EMPTY_TRASH),
    ).toBeInTheDocument();
  });
});
