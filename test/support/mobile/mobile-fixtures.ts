import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE, WINDOW_RESTORE_STATE, WINDOW_STATE } from "@/constants/widgets/widget";
import type { FilesystemEntry } from "@/types/filesystem/filesystem";
import type { WidgetFileDocument } from "@/types/widgets/widget-file";
import { fileEntry } from "@test/support/filesystem/file-entry";

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
