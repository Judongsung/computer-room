import { describe, expect, it } from "vitest";
import { WidgetLayoutService } from "@/application/widgets/widget-layout-service";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import { WIDGET_ERRORS } from "@/constants/widgets/errors/widget";
import {
  MemoryChecklistRepository,
  MemoryFileRepository,
  MemoryMemoRepository,
  MemoryWidgetLayoutRepository,
  StaticClock,
  SequenceIdGenerator,
} from "@test/support/fakes";

const MEMO_WINDOW_POLICY = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
const NOW = Date.parse("2026-08-20T01:00:00.000Z");

describe("WidgetLayoutService", () => {
  it("validates, sorts, and replaces the complete layout", async () => {
    const repository = new MemoryWidgetLayoutRepository();
    const service = new WidgetLayoutService(
      repository,
      new MemoryMemoRepository(),
      new MemoryChecklistRepository(),
      new MemoryFileRepository(),
      new SequenceIdGenerator([
        "00000000-0000-4000-8000-000000000010",
      ]),
      new StaticClock(NOW),
    );
    const right = {
      id: "00000000-0000-4000-8000-000000000002",
      type: WIDGET_TYPE.MEMO,
      position: { x: 72, y: 32 },
      size: {
        width: MEMO_WINDOW_POLICY.DEFAULT_WIDTH,
        height: MEMO_WINDOW_POLICY.DEFAULT_HEIGHT,
      },
      windowState: WINDOW_STATE.NORMAL,
      restoreState: WINDOW_RESTORE_STATE.NORMAL,
      stackOrder: 1,
    } as const;
    const left = {
      id: "00000000-0000-4000-8000-000000000001",
      type: WIDGET_TYPE.MEMO,
      position: { x: 32, y: 32 },
      size: {
        width: MEMO_WINDOW_POLICY.DEFAULT_WIDTH,
        height: MEMO_WINDOW_POLICY.DEFAULT_HEIGHT,
      },
      windowState: WINDOW_STATE.NORMAL,
      restoreState: WINDOW_RESTORE_STATE.NORMAL,
      stackOrder: 0,
    } as const;

    await repository.insert(right);
    await repository.insert(left);
    const expected = [left, right].map((widget) => ({
      ...widget,
      file: null,
      data: { markdown: "", updatedAt: null },
    }));

    await expect(service.replaceWidgets([right, left])).resolves.toEqual(expected);
    await expect(service.listWidgets()).resolves.toEqual(expected);
  });

  it("creates one persistent storage status widget and reopens the same instance", async () => {
    const repository = new MemoryWidgetLayoutRepository();
    const service = new WidgetLayoutService(
      repository,
      new MemoryMemoRepository(),
      new MemoryChecklistRepository(),
      new MemoryFileRepository(),
      new SequenceIdGenerator([
        "00000000-0000-4000-8000-000000000020",
        "00000000-0000-4000-8000-000000000021",
      ]),
      new StaticClock(NOW),
    );
    const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.STORAGE_STATUS];
    const input = {
      type: WIDGET_TYPE.STORAGE_STATUS,
      position: { x: 32, y: 32 },
      size: {
        width: policy.DEFAULT_WIDTH,
        height: policy.DEFAULT_HEIGHT,
      },
    } as const;

    const first = await service.createWidget(input);
    expect(first.created).toBe(true);
    await service.closeWidget(first.widget.id);

    const reopened = await service.createWidget({
      ...input,
      position: { x: 96, y: 96 },
    });
    expect(reopened.created).toBe(false);
    expect(reopened.widget.id).toBe(first.widget.id);
    expect(repository.records).toHaveLength(1);
    expect(repository.records[0]?.isOpen).toBe(true);
  });

  it("does not save or discard the built-in storage status widget as a file", async () => {
    const service = new WidgetLayoutService(
      new MemoryWidgetLayoutRepository(),
      new MemoryMemoRepository(),
      new MemoryChecklistRepository(),
      new MemoryFileRepository(),
      new SequenceIdGenerator([
        "00000000-0000-4000-8000-000000000030",
      ]),
      new StaticClock(NOW),
    );
    const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.STORAGE_STATUS];
    const { widget } = await service.createWidget({
      type: WIDGET_TYPE.STORAGE_STATUS,
      position: { x: 32, y: 32 },
      size: {
        width: policy.DEFAULT_WIDTH,
        height: policy.DEFAULT_HEIGHT,
      },
    });

    await expect(
      service.saveWidgetFile(widget.id, {
        parentId: "system-desktop-root",
        name: "storage",
      }),
    ).rejects.toMatchObject({ code: WIDGET_ERRORS.WIDGET_FILE_NOT_SUPPORTED.code });
    await expect(service.discardWidget(widget.id)).rejects.toMatchObject({
      code: WIDGET_ERRORS.BUILT_IN_WIDGET_DISCARD_NOT_ALLOWED.code,
    });
  });
});
