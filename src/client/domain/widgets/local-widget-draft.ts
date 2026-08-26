import { MAX_ACTIVE_CHECKLIST_ITEMS } from "@/constants/widgets/checklist";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { getKoreaDateContext } from "@/domain/shared/korea-date";
import { LOCAL_WIDGET_DRAFT_VERSION } from "@client/constants/widgets/local-widget-draft";
import type { LocalWidgetDraft } from "@client/types/widgets/local-widget-draft";

export function parseLocalWidgetDraft(value: unknown): LocalWidgetDraft | null {
  if (
    !isRecord(value) ||
    value.version !== LOCAL_WIDGET_DRAFT_VERSION ||
    typeof value.id !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  if (value.type === WIDGET_TYPE.MEMO && typeof value.markdown === "string") {
    return {
      version: LOCAL_WIDGET_DRAFT_VERSION,
      id: value.id,
      type: WIDGET_TYPE.MEMO,
      markdown: value.markdown,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }
  if (
    value.type !== WIDGET_TYPE.DAILY_CHECKLIST ||
    typeof value.businessDate !== "string" ||
    !Array.isArray(value.items) ||
    value.items.length > MAX_ACTIVE_CHECKLIST_ITEMS ||
    !value.items.every(isChecklistItem)
  ) {
    return null;
  }
  return {
    version: LOCAL_WIDGET_DRAFT_VERSION,
    id: value.id,
    type: WIDGET_TYPE.DAILY_CHECKLIST,
    businessDate: value.businessDate,
    items: value.items.map((item) => ({
      id: item.id as string,
      label: item.label as string,
      checked: item.checked as boolean,
    })),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function resetLocalChecklistForKoreaDate(
  draft: LocalWidgetDraft,
  now: number,
): LocalWidgetDraft {
  if (draft.type !== WIDGET_TYPE.DAILY_CHECKLIST) return draft;
  const businessDate = getKoreaDateContext(now).businessDate;
  if (businessDate === draft.businessDate) return draft;
  return {
    ...draft,
    businessDate,
    updatedAt: new Date(now).toISOString(),
    items: draft.items.map((item) => ({ ...item, checked: false })),
  };
}

function isChecklistItem(value: unknown): value is {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
} {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.checked === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
