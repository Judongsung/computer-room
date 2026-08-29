import { WIDGET_FILE_TYPE_VALUES } from "@/constants/widgets/widget-file";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { CreateWidgetFileInput, WidgetFileType } from "@/types/widgets/widget-file";

const WIDGET_FILE_INPUT_DATA_VALIDATORS = {
  [WIDGET_TYPE.MEMO]: (value: unknown): boolean =>
    isRecord(value) && typeof value.markdown === "string",
  [WIDGET_TYPE.DAILY_CHECKLIST]: (value: unknown): boolean =>
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isRecord(item) &&
        typeof item.label === "string" &&
        typeof item.checked === "boolean",
    ),
} satisfies Record<WidgetFileType, (value: unknown) => boolean>;

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
  const type = WIDGET_FILE_TYPE_VALUES.find(
    (candidate) => candidate === value.type,
  );
  return (
    type !== undefined && WIDGET_FILE_INPUT_DATA_VALIDATORS[type](value.data)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
