import { render } from "@testing-library/react";
import { vi } from "vitest";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { MAX_FILE_SIZE_BYTES } from "@/constants/filesystem/file";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import {
  WIDGET_TYPE,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import type {
  FilesystemDirectoryPage,
  FilesystemEntry,
} from "@/types/filesystem/filesystem";
import type { SessionInfo } from "@/types/platform/auth";
import type { WidgetFileDocument } from "@/types/widgets/widget-file";
import { App } from "@client/app";
import { CLIENT_INTERFACE_MODE } from "@client/constants/shared/interface-mode";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { MobilePreferencesGateway } from "@client/types/platform/mobile-preferences";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { WidgetFileGateway } from "@client/types/widgets/widget-file";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { fileEntry } from "@test/support/filesystem/file-entry";

const SESSION: SessionInfo = {
  email: "owner@example.com",
  logoutUrl: "/logout",
  filePolicy: { maxUploadSizeBytes: MAX_FILE_SIZE_BYTES },
};

export function renderMobile({
  dashboard = dashboardGateway(),
  filesystem = filesystemGateway(),
  widgetFileApi = widgetFileGateway(),
  mobilePreferencesApi = mobilePreferencesGateway(),
}: {
  readonly dashboard?: DashboardGateway;
  readonly filesystem?: FilesystemGateway;
  readonly widgetFileApi?: WidgetFileGateway;
  readonly mobilePreferencesApi?: MobilePreferencesGateway;
} = {}): void {
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

export function dashboardGateway(
  listWidgets = vi.fn(async () => []),
): DashboardGateway {
  const gateway = new FakeDashboardGateway();
  gateway.getSession = vi.fn(async () => SESSION);
  gateway.listWidgets = listWidgets;
  return gateway;
}

export function filesystemGateway(
  desktopEntries?: readonly FilesystemEntry[],
): FilesystemGateway {
  const picture = pictureEntry();
  const gateway = new FakeFilesystemGateway();
  gateway.listDirectory = vi.fn(
    async (parentId = FILESYSTEM_ROOT_ID.DOCUMENTS) =>
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

export function mobilePreferencesGateway(): MobilePreferencesGateway {
  return {
    getPreferences: vi.fn(async () => ({ wallpaper: null })),
    updateWallpaper: vi.fn(async () => ({ wallpaper: null })),
  };
}

export function pictureEntry(): Extract<FilesystemEntry, { kind: "file" }> {
  return fileEntry("picture-file", "사진", "image/png");
}

export function widgetEntry(): Extract<
  FilesystemEntry,
  { kind: "widget" }
> {
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

export function widgetDocument(
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
