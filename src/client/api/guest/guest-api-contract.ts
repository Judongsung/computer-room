import { WIDGET_TYPE } from "@/constants/widgets/widget";
import {
  isDailyChecklistData,
  isMemoData,
} from "@/domain/widgets/widget-data";
import type {
  GuestProgramDocument,
  GuestSessionInfo,
} from "@/types/guest/guest";
import { isWidgetEntry } from "@client/api/filesystem/filesystem-api-contract";
import { isRecord } from "@client/api/shared/api-contract";

export function isGuestSessionInfo(value: unknown): value is GuestSessionInfo {
  return (
    isRecord(value) &&
    typeof value.enabled === "boolean" &&
    typeof value.loginUrl === "string"
  );
}

export function isGuestProgramDocument(
  value: unknown,
): value is GuestProgramDocument {
  if (!isRecord(value) || !isWidgetEntry(value.entry)) return false;
  if (value.type === WIDGET_TYPE.MEMO) {
    return value.entry.widgetType === value.type && isMemoData(value.data);
  }
  if (value.type === WIDGET_TYPE.DAILY_CHECKLIST) {
    return (
      value.entry.widgetType === value.type && isDailyChecklistData(value.data)
    );
  }
  return false;
}
