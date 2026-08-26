import { render, screen } from "@testing-library/react";
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
import { MOBILE_COPY } from "@client/constants/shared/mobile";
import { LOCAL_WIDGET_DRAFT_STORAGE_KEY, LOCAL_WIDGET_DRAFT_VERSION } from "@client/constants/widgets/local-widget-draft";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";

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
    const dashboard = {
      ...dashboardGateway(),
      openWidget,
    } as unknown as DashboardGateway;
    const user = userEvent.setup();

    renderMobile({
      dashboard,
      filesystem: filesystemGateway([entry]),
      widgetFileApi: { getWidgetFile } as unknown as WidgetFileGateway,
    });

    await user.click(await screen.findByRole("button", { name: entry.name }));

    expect(await screen.findByText("모바일에서도 읽는 메모")).toBeInTheDocument();
    expect(getWidgetFile).toHaveBeenCalledWith(entry.id);
    expect(openWidget).not.toHaveBeenCalled();
  });
});

function renderMobile({
  dashboard,
  filesystem = filesystemGateway(),
  widgetFileApi = {} as WidgetFileGateway,
}: {
  readonly dashboard: DashboardGateway;
  readonly filesystem?: FilesystemGateway;
  readonly widgetFileApi?: WidgetFileGateway;
}) {
  render(
    <App
      interfaceMode={CLIENT_INTERFACE_MODE.MOBILE}
      api={dashboard}
      filesystemApi={filesystem}
      storageStatusApi={{ getStatus: vi.fn() } as unknown as StorageStatusGateway}
      widgetFileApi={widgetFileApi}
    />,
  );
}

function dashboardGateway(
  listWidgets = vi.fn(async () => []),
): DashboardGateway {
  return {
    getSession: vi.fn(async () => SESSION),
    listWidgets,
  } as unknown as DashboardGateway;
}

function filesystemGateway(
  desktopEntries?: readonly FilesystemEntry[],
): FilesystemGateway {
  const picture: FilesystemEntry = {
    id: "picture-file",
    parentId: FILESYSTEM_ROOT_ID.DESKTOP,
    kind: FILESYSTEM_ENTRY_KIND.FILE,
    name: "사진",
    contentType: "image/png",
    size: 10,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    desktopOrder: 0,
  };
  return {
    listDirectory: vi.fn(async (parentId = FILESYSTEM_ROOT_ID.DOCUMENTS) =>
      directoryPage(
        parentId,
        parentId === FILESYSTEM_ROOT_ID.DESKTOP
          ? (desktopEntries ?? [picture])
          : [],
      ),
    ),
    thumbnailUrl: (id: string) => `/thumbnail/${id}`,
    contentUrl: (id: string) => `/content/${id}`,
    downloadUrl: (id: string) => `/download/${id}`,
  } as unknown as FilesystemGateway;
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
