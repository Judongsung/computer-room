import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { CreateWidgetFileInput } from "@/types/widgets/widget-file";

export function isCreateWidgetFileInput(
  value: unknown,
): value is CreateWidgetFileInput {
  if (
    !isRecord(value) ||
    typeof value.parentId !== "string" ||
    typeof value.name !== "string" ||
    !isRecord(value.data)
  ) {
    return false;
  }
  if (value.type === WIDGET_TYPE.MEMO) {
    return typeof value.data.markdown === "string";
  }
  return (
    value.type === WIDGET_TYPE.DAILY_CHECKLIST &&
    Array.isArray(value.data.items) &&
    value.data.items.every(
      (item) =>
        isRecord(item) &&
        typeof item.label === "string" &&
        typeof item.checked === "boolean",
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
