import { describe, expect, it } from "vitest";
import { WidgetLayoutService } from "@/application/widgets/widget-layout-service";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import { WIDGET_ERRORS } from "@/constants/widgets/errors/widget";
import type { WidgetLayout } from "@/types/widgets/widget";
import { SequenceIdGenerator, StaticClock } from "@test/support/platform/runtime-fakes";
import { MemoryChecklistRepository } from "@test/support/widgets/memory-checklist-repository";
import {
  MemoryMemoRepository,
  MemoryWidgetLayoutRepository,
} from "@test/support/widgets/memory-widget-repositories";

const MEMO_WINDOW_POLICY = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
const NOW = Date.parse("2026-08-20T01:00:00.000Z");

describe("WidgetLayoutService", () => {
  it("validates, sorts, and replaces the complete layout", async () => {
    const repository = new MemoryWidgetLayoutRepository();
    const service = new WidgetLayoutService(
      repository,
      new MemoryMemoRepository(),
      new MemoryChecklistRepository(),
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

  it.each([
    WIDGET_TYPE.STORAGE_STATUS,
    WIDGET_TYPE.IMAGE_UPLOAD_PROFILES,
    WIDGET_TYPE.ADMIN,
  ] as const)("keeps the %s singleton while making its open state session-only", async (type) => {
    const repository = new MemoryWidgetLayoutRepository();
    const service = new WidgetLayoutService(
      repository,
      new MemoryMemoRepository(),
      new MemoryChecklistRepository(),
      new SequenceIdGenerator([
        "00000000-0000-4000-8000-000000000020",
        "00000000-0000-4000-8000-000000000021",
      ]),
      new StaticClock(NOW),
    );
    const policy = WIDGET_WINDOW_POLICY[type];
    const input = {
      type,
      position: { x: 32, y: 32 },
      size: {
        width: policy.DEFAULT_WIDTH,
        height: policy.DEFAULT_HEIGHT,
      },
    } as const;

    const first = await service.createWidget(input);
    expect(first.created).toBe(true);
    expect(repository.records[0]?.isOpen).toBe(false);

    repository.records = repository.records.map((widget) => ({
      ...widget,
      isOpen: true,
    }));
    await expect(service.listWidgets()).resolves.toEqual([]);
    expect(repository.records[0]?.isOpen).toBe(false);

    const movedLayout: WidgetLayout = {
      id: first.widget.id,
      type,
      position: { x: 72, y: 80 },
      size: first.widget.size,
      windowState: first.widget.windowState,
      restoreState: first.widget.restoreState,
      stackOrder: first.widget.stackOrder,
    };
    await expect(service.replaceWidgets([movedLayout])).resolves.toEqual([
      { ...movedLayout, file: null, data: null },
    ]);
    expect(repository.records[0]).toMatchObject({
      position: movedLayout.position,
      isOpen: false,
    });
    await service.closeWidget(first.widget.id);

    const reopened = await service.createWidget({
      ...input,
      position: { x: 96, y: 96 },
    });
    expect(reopened.created).toBe(false);
    expect(reopened.widget.id).toBe(first.widget.id);
    expect(reopened.widget.position).toEqual(movedLayout.position);
    expect(repository.records).toHaveLength(1);
    expect(repository.records[0]?.isOpen).toBe(false);
  });

  it("does not discard the built-in storage status widget", async () => {
    const service = new WidgetLayoutService(
      new MemoryWidgetLayoutRepository(),
      new MemoryMemoRepository(),
      new MemoryChecklistRepository(),
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
    await expect(service.discardWidget(widget.id)).rejects.toMatchObject({
      code: WIDGET_ERRORS.BUILT_IN_WIDGET_DISCARD_NOT_ALLOWED.code,
    });
  });
});
