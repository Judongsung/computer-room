import { describe, expect, it } from "vitest";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { isCreateWidgetFileInput } from "@/domain/widgets/widget-file-contract";

describe("widget file contracts", () => {
  it("accepts each file-capable widget input", () => {
    expect(isCreateWidgetFileInput({
      parentId: "documents",
      name: "memo",
      type: WIDGET_TYPE.MEMO,
      data: { markdown: "# memo" },
    })).toBe(true);
    expect(isCreateWidgetFileInput({
      parentId: "documents",
      name: "checklist",
      type: WIDGET_TYPE.DAILY_CHECKLIST,
      data: { items: [{ label: "item", checked: false }] },
    })).toBe(true);
  });

  it("rejects built-in widgets and invalid type-specific data", () => {
    expect(isCreateWidgetFileInput({
      parentId: "documents",
      name: "storage",
      type: WIDGET_TYPE.STORAGE_STATUS,
      data: {},
    })).toBe(false);
    expect(isCreateWidgetFileInput({
      parentId: "documents",
      name: "memo",
      type: WIDGET_TYPE.MEMO,
      data: { markdown: 1 },
    })).toBe(false);
  });
});
