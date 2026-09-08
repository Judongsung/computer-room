import type { CreateWidgetFileInput, WidgetFileDraftContent } from "@/types/widgets/widget-file";
import type { MemoWidget } from "@/types/widgets/widget";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import {
  cloneDashboardWidget,
  isWidgetDataForType,
  widgetTypeSupportsFileReference,
} from "@/domain/widgets/widget-data";
import { isDashboardWidget } from "@/domain/widgets/widget-contract";
import type { DashboardWidget, WidgetType } from "@/types/widgets/widget";

describe("widget data strategies", () => {
  it("returns the public kind instead of promising arbitrary subtype metadata", () => {
    const original = { ...widget(WIDGET_TYPE.MEMO, { file: null, data: { markdown: "memo", updatedAt: null } }), extra: "private" };
    const copy = cloneDashboardWidget(original);
    expectTypeOf(copy).toEqualTypeOf<MemoWidget>();
    // @ts-expect-error Arbitrary subtype fields are not part of the clone contract.
    expect(copy.extra).toBeUndefined();
    expect(original.extra).toBe("private");
    expect(original.data.markdown).toBe("memo");
    // @ts-expect-error A memo draft cannot carry checklist data.
    const invalidInput: CreateWidgetFileInput = { parentId: "documents", name: "memo", type: WIDGET_TYPE.MEMO, data: { items: [] } };
    // @ts-expect-error A stored checklist draft must carry checklist content.
    const invalidContent: WidgetFileDraftContent = { type: WIDGET_TYPE.DAILY_CHECKLIST, markdown: "memo" };
    void invalidInput;
    void invalidContent;
  });
  it("deeply clones every stateful widget and reuses the stateless policy", () => {
    const memo = widget(WIDGET_TYPE.MEMO, {
      file: { entryId: "memo-entry", parentId: "documents", name: "메모" },
      data: { markdown: "# 메모", updatedAt: null },
    });
    const checklist = widget(WIDGET_TYPE.DAILY_CHECKLIST, {
      file: null,
      data: {
        businessDate: "2026-08-29",
        nextResetAt: "2026-08-29T15:00:00.000Z",
        items: [{ id: "item-1", label: "확인", checked: true }],
      },
    });
    const storage = widget(WIDGET_TYPE.STORAGE_STATUS, {
      file: null,
      data: null,
    });
    const profiles = widget(WIDGET_TYPE.IMAGE_UPLOAD_PROFILES, {
      file: null,
      data: null,
    });
    const admin = widget(WIDGET_TYPE.ADMIN, {
      file: null,
      data: null,
    });

    const memoClone = cloneDashboardWidget(memo);
    const checklistClone = cloneDashboardWidget(checklist);
    const storageClone = cloneDashboardWidget(storage);
    const profilesClone = cloneDashboardWidget(profiles);
    const adminClone = cloneDashboardWidget(admin);

    expect(memoClone).toEqual(memo);
    expect(memoClone).not.toBe(memo);
    expect(memoClone.position).not.toBe(memo.position);
    expect(memoClone.size).not.toBe(memo.size);
    expect(memoClone.file).not.toBe(memo.file);
    expect(memoClone.data).not.toBe(memo.data);
    expect(checklistClone.data).not.toBe(checklist.data);
    expect(checklistClone.data.items[0]).not.toBe(checklist.data.items[0]);
    expect(storageClone.data).toBeNull();
    expect(profilesClone.data).toBeNull();
    expect(adminClone.data).toBeNull();
  });

  it("validates data and file-reference policies by widget type", () => {
    expect(isWidgetDataForType(WIDGET_TYPE.MEMO, {
      markdown: "memo",
      updatedAt: null,
    })).toBe(true);
    expect(isWidgetDataForType(WIDGET_TYPE.DAILY_CHECKLIST, {
      businessDate: "2026-08-29",
      nextResetAt: "2026-08-29T15:00:00.000Z",
      items: [{ id: "item-1", label: "item", checked: false }],
    })).toBe(true);
    expect(isWidgetDataForType(WIDGET_TYPE.STORAGE_STATUS, null)).toBe(true);
    expect(isWidgetDataForType(WIDGET_TYPE.IMAGE_UPLOAD_PROFILES, {})).toBe(false);
    expect(isWidgetDataForType(WIDGET_TYPE.ADMIN, null)).toBe(true);
    expect(widgetTypeSupportsFileReference(WIDGET_TYPE.MEMO)).toBe(true);
    expect(widgetTypeSupportsFileReference(WIDGET_TYPE.DAILY_CHECKLIST)).toBe(true);
    expect(widgetTypeSupportsFileReference(WIDGET_TYPE.STORAGE_STATUS)).toBe(false);
    expect(widgetTypeSupportsFileReference(WIDGET_TYPE.IMAGE_UPLOAD_PROFILES)).toBe(false);
    expect(widgetTypeSupportsFileReference(WIDGET_TYPE.ADMIN)).toBe(false);

    const storage = widget(WIDGET_TYPE.STORAGE_STATUS, {
      file: null,
      data: null,
    });
    expect(isDashboardWidget({
      ...storage,
      file: { entryId: "entry", parentId: "documents", name: "invalid" },
    })).toBe(false);
  });
});

function widget<T extends WidgetType>(
  type: T,
  values: Pick<Extract<DashboardWidget, { type: T }>, "file" | "data">,
): Extract<DashboardWidget, { type: T }> {
  const policy = WIDGET_WINDOW_POLICY[type];
  return {
    id: `${type}-widget`,
    type,
    position: { x: 16, y: 24 },
    size: { width: policy.DEFAULT_WIDTH, height: policy.DEFAULT_HEIGHT },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
    stackOrder: 0,
    ...values,
  } as unknown as Extract<DashboardWidget, { type: T }>;
}
