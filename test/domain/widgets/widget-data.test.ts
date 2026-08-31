import { describe, expect, it } from "vitest";
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
