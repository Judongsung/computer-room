import { describe, expect, it } from "vitest";
import { WidgetFileService } from "@/application/widgets/widget-file-service";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { WIDGET_ERRORS } from "@/constants/widgets/errors/widget";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import type { DashboardWidget, MemoWidget } from "@/types/widgets/widget";
import type { WidgetFileDraftRepository } from "@/types/widgets/widget-file-repository";
import type { WidgetReader } from "@/types/widgets/widget-service";
import { MemoryFileRepository } from "@test/support/filesystem/memory-filesystem-repository";
import {
  SequenceIdGenerator,
  StaticClock,
} from "@test/support/platform/runtime-fakes";

const NOW = Date.parse("2026-08-28T01:00:00.000Z");
const UNUSED_DRAFTS: WidgetFileDraftRepository = {
  async insert() {},
};

describe("WidgetFileService", () => {
  it("saves an existing widget through the shared file policy", async () => {
    const filesystem = new MemoryFileRepository();
    const widget = memoWidget("memo-widget");
    const widgets = filesystemBackedWidgetReader(widget, filesystem);
    const service = new WidgetFileService(
      widgets,
      filesystem,
      UNUSED_DRAFTS,
      new SequenceIdGenerator(["memo-entry"]),
      new StaticClock(NOW),
    );

    const result = await service.save(widget.id, {
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      name: "내 메모",
    });

    expect(result.entry).toMatchObject({
      id: "memo-entry",
      widgetId: widget.id,
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      name: "내 메모",
      desktopOrder: 0,
    });
    expect(result.widget.file).toEqual({
      entryId: "memo-entry",
      parentId: FILESYSTEM_ROOT_ID.DESKTOP,
      name: "내 메모",
    });
  });

  it("rejects file storage for a built-in widget", async () => {
    const filesystem = new MemoryFileRepository();
    const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.STORAGE_STATUS];
    const widget: DashboardWidget = {
      id: "storage-widget",
      type: WIDGET_TYPE.STORAGE_STATUS,
      position: { x: 32, y: 32 },
      size: {
        width: policy.DEFAULT_WIDTH,
        height: policy.DEFAULT_HEIGHT,
      },
      windowState: WINDOW_STATE.NORMAL,
      restoreState: WINDOW_RESTORE_STATE.NORMAL,
      stackOrder: 0,
      file: null,
      data: null,
    };
    const service = new WidgetFileService(
      { async getWidget() { return widget; } },
      filesystem,
      UNUSED_DRAFTS,
      new SequenceIdGenerator(["unused"]),
      new StaticClock(NOW),
    );

    await expect(
      service.save(widget.id, {
        parentId: FILESYSTEM_ROOT_ID.DESKTOP,
        name: "저장소",
      }),
    ).rejects.toMatchObject({
      code: WIDGET_ERRORS.WIDGET_FILE_NOT_SUPPORTED.code,
    });
  });
});

function memoWidget(id: string): MemoWidget {
  const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
  return {
    id,
    type: WIDGET_TYPE.MEMO,
    position: { x: 32, y: 32 },
    size: {
      width: policy.DEFAULT_WIDTH,
      height: policy.DEFAULT_HEIGHT,
    },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
    stackOrder: 0,
    file: null,
    data: { markdown: "테스트", updatedAt: null },
  };
}

function filesystemBackedWidgetReader(
  widget: MemoWidget,
  filesystem: MemoryFileRepository,
): WidgetReader {
  return {
    async getWidget() {
      const entry = await filesystem.findWidgetEntry(widget.id);
      return entry
        ? {
            ...widget,
            file: {
              entryId: entry.id,
              parentId: entry.parentId ?? "",
              name: entry.name,
            },
          }
        : widget;
    },
  };
}
