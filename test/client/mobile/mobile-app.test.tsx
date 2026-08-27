import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import { MAX_FILE_SIZE_BYTES } from "@/constants/filesystem/file";
import {
  WIDGET_TYPE,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import type { SessionInfo } from "@/types/platform/auth";
import type { FilesystemDirectoryPage, FilesystemEntry } from "@/types/filesystem/filesystem";
import type { WidgetFileDocument } from "@/types/widgets/widget-file";
import { App } from "@client/app";
import { CLIENT_INTERFACE_MODE } from "@client/constants/shared/interface-mode";
import {
  MOBILE_COPY,
  MOBILE_CSS_VARIABLE,
} from "@client/constants/shared/mobile";
import { POINTER_TYPE } from "@client/constants/shared/pointer";
import { LOCAL_WIDGET_DRAFT_STORAGE_KEY, LOCAL_WIDGET_DRAFT_VERSION } from "@client/constants/widgets/local-widget-draft";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";
import type { MobilePreferencesGateway } from "@client/types/platform/mobile-preferences";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";

const SESSION: SessionInfo = {
  email: "owner@example.com",
  logoutUrl: "/logout",
  filePolicy: { maxUploadSizeBytes: MAX_FILE_SIZE_BYTES },
};

describe("mobile application", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("shows the Android home without loading PC-open widgets", async () => {
    const listWidgets = vi.fn(async () => []);
    const dashboard = dashboardGateway(listWidgets);
    const user = userEvent.setup();
    renderMobile({ dashboard });

    expect(await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN })).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: MOBILE_COPY.MY_DOCUMENTS })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: MOBILE_COPY.MY_COMPUTER })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: MOBILE_COPY.RECYCLE_BIN })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "사진" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: MOBILE_COPY.MENU })).toBeEnabled();
    expect(listWidgets).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: MOBILE_COPY.MY_DOCUMENTS }));
    expect(await screen.findByRole("heading", { name: MOBILE_COPY.MY_DOCUMENTS })).toBeInTheDocument();
    expect(listWidgets).not.toHaveBeenCalled();
  });

  it("creates one local memo draft from My Computer", async () => {
    const user = userEvent.setup();
    renderMobile({ dashboard: dashboardGateway() });
    await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN });
    await user.click(screen.getByRole("button", { name: MOBILE_COPY.MY_COMPUTER }));
    expect(screen.getByRole("button", { name: MOBILE_COPY.MENU })).toBeDisabled();
    await user.click(await screen.findByRole("button", { name: MOBILE_COPY.CREATE_MEMO }));

    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    const stored = JSON.parse(
      window.localStorage.getItem(LOCAL_WIDGET_DRAFT_STORAGE_KEY) ?? "null",
    ) as { type?: string; version?: number } | null;
    expect(stored).toMatchObject({
      type: WIDGET_TYPE.MEMO,
      version: LOCAL_WIDGET_DRAFT_VERSION,
    });
  });

  it("resumes the last local draft instead of PC widgets after reload", async () => {
    window.localStorage.setItem(
      LOCAL_WIDGET_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: LOCAL_WIDGET_DRAFT_VERSION,
        id: "local-draft",
        type: WIDGET_TYPE.MEMO,
        markdown: "휴대폰 초안",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
    const listWidgets = vi.fn(async () => []);
    renderMobile({ dashboard: dashboardGateway(listWidgets) });

    expect(await screen.findByDisplayValue("휴대폰 초안")).toBeInTheDocument();
    expect(listWidgets).not.toHaveBeenCalled();
  });

  it("reads a saved widget file without opening the PC widget window", async () => {
    const entry = widgetEntry();
    const document = widgetDocument(entry);
    const getWidgetFile = vi.fn(async () => document);
    const openWidget = vi.fn();
    const dashboard = dashboardGateway();
    dashboard.openWidget = openWidget;
    const user = userEvent.setup();

    renderMobile({
      dashboard,
      filesystem: filesystemGateway([entry]),
      widgetFileApi: {
        getWidgetFile,
        createWidgetFile: vi.fn(async () => {
          throw new Error("Unexpected widget file creation.");
        }),
      },
    });

    await user.click(await screen.findByRole("button", { name: entry.name }));

    expect(await screen.findByText("모바일에서도 읽는 메모")).toBeInTheDocument();
    expect(getWidgetFile).toHaveBeenCalledWith(entry.id);
    expect(openWidget).not.toHaveBeenCalled();
  });

  it("replaces the current image while swiping without adding history", async () => {
    const first = pictureEntry();
    const second = fileEntry("picture-file-2", "두 번째 사진", "image/webp");
    const filesystem = filesystemGateway([first, second]);
    const user = userEvent.setup();
    renderMobile({
      dashboard: dashboardGateway(),
      filesystem,
    });

    await user.click(await screen.findByRole("button", { name: first.name }));
    expect(
      await screen.findByRole("heading", { name: first.name }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(filesystem.listDirectory).toHaveBeenCalledTimes(2),
    );
    const viewport = screen.getByAltText(first.name).parentElement;
    if (!viewport) throw new Error("Expected image swipe viewport.");
    fireEvent.pointerDown(viewport, {
      pointerId: 1,
      isPrimary: true,
      clientX: 260,
      clientY: 100,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 1,
      clientX: 120,
      clientY: 100,
    });

    expect(
      await screen.findByRole("heading", { name: second.name }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: MOBILE_COPY.BACK }));
    expect(
      await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN }),
    ).toBeInTheDocument();
  });

  it("opens home on the first touch after an image swipe omits click", async () => {
    const first = pictureEntry();
    const second = fileEntry("picture-file-2", "두 번째 사진", "image/webp");
    const filesystem = filesystemGateway([first, second]);
    const user = userEvent.setup();
    renderMobile({
      dashboard: dashboardGateway(),
      filesystem,
    });

    await user.click(await screen.findByRole("button", { name: first.name }));
    await waitFor(() =>
      expect(filesystem.listDirectory).toHaveBeenCalledTimes(2),
    );
    const viewport = screen.getByAltText(first.name).parentElement;
    if (!viewport) throw new Error("Expected image swipe viewport.");
    fireEvent.pointerDown(viewport, {
      pointerId: 1,
      pointerType: POINTER_TYPE.TOUCH,
      isPrimary: true,
      clientX: 260,
      clientY: 100,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 1,
      pointerType: POINTER_TYPE.TOUCH,
      isPrimary: true,
      clientX: 120,
      clientY: 100,
    });
    expect(
      await screen.findByRole("heading", { name: second.name }),
    ).toBeInTheDocument();

    const home = screen.getByRole("button", { name: MOBILE_COPY.HOME });
    fireEvent.pointerDown(home, {
      pointerId: 2,
      pointerType: POINTER_TYPE.TOUCH,
      isPrimary: true,
    });
    fireEvent.pointerUp(home, {
      pointerId: 2,
      pointerType: POINTER_TYPE.TOUCH,
      isPrimary: true,
    });

    expect(
      await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN }),
    ).toBeInTheDocument();
  });

  it("applies the shared wallpaper only to the home and resets it to default", async () => {
    const wallpaper = pictureEntry();
    const updateWallpaper = vi.fn(async () => ({ wallpaper: null }));
    const user = userEvent.setup();
    renderMobile({
      dashboard: dashboardGateway(),
      filesystem: filesystemGateway([wallpaper]),
      mobilePreferencesApi: {
        getPreferences: vi.fn(async () => ({ wallpaper })),
        updateWallpaper,
      },
    });

    const home = await screen.findByRole("main", {
      name: MOBILE_COPY.HOME_SCREEN,
    });
    await waitFor(() =>
      expect(
        home.style.getPropertyValue(MOBILE_CSS_VARIABLE.HOME_WALLPAPER_IMAGE),
      ).toContain(`/content/${wallpaper.id}`),
    );

    await user.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
    await user.click(screen.getByRole("button", { name: MOBILE_COPY.WALLPAPER }));
    expect(
      await screen.findByRole("heading", { name: MOBILE_COPY.WALLPAPER }),
    ).toBeInTheDocument();
    fireEvent.load(screen.getByAltText(wallpaper.name));
    await user.click(
      screen.getByRole("button", { name: MOBILE_COPY.USE_DEFAULT_WALLPAPER }),
    );
    await user.click(
      screen.getByRole("button", { name: MOBILE_COPY.SET_WALLPAPER }),
    );

    await waitFor(() => expect(updateWallpaper).toHaveBeenCalledWith(null));
    const restoredHome = await screen.findByRole("main", {
      name: MOBILE_COPY.HOME_SCREEN,
    });
    expect(
      restoredHome.style.getPropertyValue(
        MOBILE_CSS_VARIABLE.HOME_WALLPAPER_IMAGE,
      ),
    ).toBe("");
  });

  it("selects an existing server image and hides non-image files", async () => {
    const wallpaper = pictureEntry();
    const textFile = fileEntry("notes", "메모.txt", "text/plain");
    const updateWallpaper = vi.fn(async () => ({ wallpaper }));
    const user = userEvent.setup();
    renderMobile({
      dashboard: dashboardGateway(),
      filesystem: filesystemGateway([wallpaper, textFile]),
      mobilePreferencesApi: {
        getPreferences: vi.fn(async () => ({ wallpaper: null })),
        updateWallpaper,
      },
    });

    await screen.findByRole("main", { name: MOBILE_COPY.HOME_SCREEN });
    await user.click(screen.getByRole("button", { name: MOBILE_COPY.MENU }));
    await user.click(screen.getByRole("button", { name: MOBILE_COPY.WALLPAPER }));
    await screen.findByRole("heading", { name: MOBILE_COPY.WALLPAPER });
    expect(screen.queryByRole("button", { name: textFile.name })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: wallpaper.name }));
    const preview = await screen.findByAltText(wallpaper.name);
    expect(
      screen.getByRole("button", { name: MOBILE_COPY.SET_WALLPAPER }),
    ).toBeDisabled();
    fireEvent.load(preview);
    expect(
      screen.getByRole("button", { name: MOBILE_COPY.SET_WALLPAPER }),
    ).toBeEnabled();
    await user.click(
      screen.getByRole("button", { name: MOBILE_COPY.SET_WALLPAPER }),
    );

    await waitFor(() =>
      expect(updateWallpaper).toHaveBeenCalledWith(wallpaper.id),
    );
    const home = await screen.findByRole("main", {
      name: MOBILE_COPY.HOME_SCREEN,
    });
    expect(
      home.style.getPropertyValue(MOBILE_CSS_VARIABLE.HOME_WALLPAPER_IMAGE),
    ).toContain(`/content/${wallpaper.id}`);
  });
});

function renderMobile({
  dashboard,
  filesystem = filesystemGateway(),
  widgetFileApi = widgetFileGateway(),
  mobilePreferencesApi = mobilePreferencesGateway(),
}: {
  readonly dashboard: DashboardGateway;
  readonly filesystem?: FilesystemGateway;
  readonly widgetFileApi?: WidgetFileGateway;
  readonly mobilePreferencesApi?: MobilePreferencesGateway;
}) {
  render(
    <App
      interfaceMode={CLIENT_INTERFACE_MODE.MOBILE}
      api={dashboard}
      filesystemApi={filesystem}
      storageStatusApi={storageStatusGateway()}
      widgetFileApi={widgetFileApi}
      mobilePreferencesApi={mobilePreferencesApi}
    />,
  );
}

function dashboardGateway(
  listWidgets = vi.fn(async () => []),
): DashboardGateway {
  const gateway = new FakeDashboardGateway();
  gateway.getSession = vi.fn(async () => SESSION);
  gateway.listWidgets = listWidgets;
  return gateway;
}

function filesystemGateway(
  desktopEntries?: readonly FilesystemEntry[],
): FilesystemGateway {
  const picture = pictureEntry();
  const gateway = new FakeFilesystemGateway();
  gateway.listDirectory = vi.fn(async (parentId = FILESYSTEM_ROOT_ID.DOCUMENTS) =>
      directoryPage(
        parentId,
        parentId === FILESYSTEM_ROOT_ID.DESKTOP
          ? (desktopEntries ?? [picture])
          : [],
      ),
    );
  gateway.thumbnailUrl = (id: string) => `/thumbnail/${id}`;
  gateway.contentUrl = (id: string) => `/content/${id}`;
  gateway.downloadUrl = (id: string) => `/download/${id}`;
  return gateway;
}

function storageStatusGateway(): StorageStatusGateway {
  return {
    getStatus: vi.fn(async () => {
      throw new Error("Unexpected storage status request.");
    }),
  };
}

function widgetFileGateway(): WidgetFileGateway {
  return {
    getWidgetFile: vi.fn(async () => {
      throw new Error("Unexpected widget file read.");
    }),
    createWidgetFile: vi.fn(async () => {
      throw new Error("Unexpected widget file creation.");
    }),
  };
}

function mobilePreferencesGateway(): MobilePreferencesGateway {
  return {
    getPreferences: vi.fn(async () => ({ wallpaper: null })),
    updateWallpaper: vi.fn(async () => ({ wallpaper: null })),
  };
}

function pictureEntry(): Extract<FilesystemEntry, { kind: "file" }> {
  return fileEntry("picture-file", "사진", "image/png");
}

function fileEntry(
  id: string,
  name: string,
  contentType: string,
): Extract<FilesystemEntry, { kind: "file" }> {
  return {
    id,
    parentId: FILESYSTEM_ROOT_ID.DESKTOP,
    kind: FILESYSTEM_ENTRY_KIND.FILE,
    name,
    contentType,
    size: 10,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    desktopOrder: 0,
  };
}

function widgetEntry(): Extract<FilesystemEntry, { kind: "widget" }> {
  return {
    id: "mobile-memo-entry",
    parentId: FILESYSTEM_ROOT_ID.DESKTOP,
    kind: FILESYSTEM_ENTRY_KIND.WIDGET,
    name: "휴대폰 메모",
    widgetId: "mobile-memo-widget",
    widgetType: WIDGET_TYPE.MEMO,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    desktopOrder: 0,
  };
}

function widgetDocument(
  entry: ReturnType<typeof widgetEntry>,
): WidgetFileDocument {
  return {
    entry,
    widget: {
      id: entry.widgetId,
      type: WIDGET_TYPE.MEMO,
      file: {
        entryId: entry.id,
        parentId: entry.parentId,
        name: entry.name,
      },
      position: { x: 0, y: 0 },
      size: { width: 480, height: 320 },
      windowState: WINDOW_STATE.NORMAL,
      restoreState: WINDOW_RESTORE_STATE.NORMAL,
      stackOrder: 0,
      data: {
        markdown: "모바일에서도 읽는 메모",
        updatedAt: new Date(0).toISOString(),
      },
    },
  };
}

function directoryPage(
  id: string,
  items: readonly FilesystemEntry[],
): FilesystemDirectoryPage {
  const name = id === FILESYSTEM_ROOT_ID.DESKTOP ? "바탕 화면" : "내 문서";
  return {
    directory: {
      id,
      parentId: null,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      desktopOrder: null,
    },
    breadcrumbs: [{ id, name }],
    items,
    nextOffset: null,
    sort: DEFAULT_FILESYSTEM_DIRECTORY_SORT,
  };
}
