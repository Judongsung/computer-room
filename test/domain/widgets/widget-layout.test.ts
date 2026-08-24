import { describe, expect, it } from "vitest";
import { WIDGET_ERRORS } from "@/constants/widgets/errors/widget";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import { widgetLayoutsEqual } from "@/domain/widgets/widget-layout";
import { validateWidgetLayout } from "@/domain/widgets/widget-layout-validation";
import type { WidgetLayout } from "@/types/widgets/widget";

describe("widget layout rules", () => {
  it("accepts overlapping windows and sorts them by stack order", () => {
    const back = widget("00000000-0000-4000-8000-000000000001", 0);
    const front = widget("00000000-0000-4000-8000-000000000002", 1);

    expect(validateWidgetLayout([front, back])).toEqual([back, front]);
    expect(widgetLayoutsEqual([back, front], [front, back])).toBe(true);
  });

  it("rejects duplicate ids, duplicate stack orders, and invalid bounds", () => {
    const first = widget("00000000-0000-4000-8000-000000000001", 0);

    expect(() => validateWidgetLayout([first, first])).toThrowError(
      expect.objectContaining({ code: WIDGET_ERRORS.DUPLICATE_WIDGET_ID.code }),
    );
    expect(() =>
      validateWidgetLayout([
        first,
        widget("00000000-0000-4000-8000-000000000002", 0),
      ]),
    ).toThrowError(
      expect.objectContaining({
        code: WIDGET_ERRORS.DUPLICATE_STACK_ORDER.code,
      }),
    );
    expect(() =>
      validateWidgetLayout([
        { ...first, size: { ...first.size, width: 1 } },
      ]),
    ).toThrowError(
      expect.objectContaining({ code: WIDGET_ERRORS.INVALID_LAYOUT.code }),
    );
  });
});

const MEMO_WINDOW_POLICY = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];

function widget(id: string, stackOrder: number): WidgetLayout {
  return {
    id,
    type: WIDGET_TYPE.MEMO,
    position: { x: 32, y: 32 },
    size: {
      width: MEMO_WINDOW_POLICY.DEFAULT_WIDTH,
      height: MEMO_WINDOW_POLICY.DEFAULT_HEIGHT,
    },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
    stackOrder,
  };
}
