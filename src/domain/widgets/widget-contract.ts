import { CHECKLIST_EVENT_ACTION_VALUES } from "@/constants/widgets/checklist";
import {
  WIDGET_TYPE,
  WINDOW_RESTORE_STATE_VALUES,
  WINDOW_STATE_VALUES,
} from "@/constants/widgets/widget";
import type {
  ChecklistCheckInput,
  ChecklistLabelInput,
} from "@/types/widgets/checklist";
import type { MemoUpdateInput } from "@/types/widgets/memo";
import type {
  ChecklistItem,
  ChecklistLogEvent,
  ChecklistLogPage,
  DailyChecklistData,
  DashboardWidget,
  DashboardWidgetCollection,
  MemoData,
} from "@/types/widgets/widget";

export function isDashboardWidgetCollection(
  value: unknown,
): value is DashboardWidgetCollection {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isDashboardWidget)
  );
}

export function isMemoData(value: unknown): value is MemoData {
  return (
    isRecord(value) &&
    typeof value.markdown === "string" &&
    (value.updatedAt === null || typeof value.updatedAt === "string")
  );
}

export function isDailyChecklistData(
  value: unknown,
): value is DailyChecklistData {
  return (
    isRecord(value) &&
    typeof value.businessDate === "string" &&
    typeof value.nextResetAt === "string" &&
    Array.isArray(value.items) &&
    value.items.every(isChecklistItem)
  );
}

export function isChecklistItem(value: unknown): value is ChecklistItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.checked === "boolean"
  );
}

export function isChecklistLogPage(value: unknown): value is ChecklistLogPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isChecklistLogEvent) &&
    (value.nextOffset === null ||
      (typeof value.nextOffset === "number" &&
        Number.isSafeInteger(value.nextOffset)))
  );
}

export function isMemoUpdateInput(value: unknown): value is MemoUpdateInput {
  return isRecord(value) && typeof value.markdown === "string";
}

export function isChecklistLabelInput(
  value: unknown,
): value is ChecklistLabelInput {
  return isRecord(value) && typeof value.label === "string";
}

export function isChecklistCheckInput(
  value: unknown,
): value is ChecklistCheckInput {
  return isRecord(value) && typeof value.checked === "boolean";
}

export function isDashboardWidget(value: unknown): value is DashboardWidget {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isWindowPosition(value.position) ||
    !isWindowSize(value.size) ||
    !WINDOW_STATE_VALUES.some((state) => value.windowState === state) ||
    !WINDOW_RESTORE_STATE_VALUES.some(
      (state) => value.restoreState === state,
    ) ||
    typeof value.stackOrder !== "number" ||
    !isWidgetFileReference(value.file)
  ) {
    return false;
  }

  if (value.type === WIDGET_TYPE.MEMO) {
    return isMemoData(value.data);
  }
  if (
    value.type === WIDGET_TYPE.DAILY_CHECKLIST &&
    isDailyChecklistData(value.data)
  ) {
    return true;
  }
  return (
    (value.type === WIDGET_TYPE.STORAGE_STATUS ||
      value.type === WIDGET_TYPE.IMAGE_UPLOAD_PROFILES) &&
    value.file === null &&
    value.data === null
  );
}

function isWidgetFileReference(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.entryId === "string" &&
      typeof value.parentId === "string" &&
      typeof value.name === "string")
  );
}

function isChecklistLogEvent(value: unknown): value is ChecklistLogEvent {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.itemId === "string" &&
    typeof value.itemLabel === "string" &&
    (value.previousItemLabel === null ||
      typeof value.previousItemLabel === "string") &&
    CHECKLIST_EVENT_ACTION_VALUES.some(
      (action) => value.action === action,
    ) &&
    typeof value.businessDate === "string" &&
    typeof value.occurredAt === "string"
  );
}

function isWindowPosition(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

function isWindowSize(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.width === "number" &&
    typeof value.height === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
