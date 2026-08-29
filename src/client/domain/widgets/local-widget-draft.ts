import { MAX_ACTIVE_CHECKLIST_ITEMS } from "@/constants/widgets/checklist";
import { WIDGET_FILE_TYPE_VALUES } from "@/constants/widgets/widget-file";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { getKoreaDateContext } from "@/domain/shared/korea-date";
import { LOCAL_WIDGET_DRAFT_VERSION } from "@client/constants/widgets/local-widget-draft";
import type {
  LocalWidgetDraft,
  LocalWidgetDraftByType,
} from "@client/types/widgets/local-widget-draft";
import type { WidgetFileType } from "@/types/widgets/widget-file";

interface LocalWidgetDraftBaseValues {
  readonly version: typeof LOCAL_WIDGET_DRAFT_VERSION;
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

type LocalWidgetDraftParserMap = {
  readonly [T in WidgetFileType]: (
    value: Readonly<Record<string, unknown>>,
    base: LocalWidgetDraftBaseValues,
  ) => LocalWidgetDraftByType<T> | null;
};

type LocalWidgetDraftFactoryMap = {
  readonly [T in WidgetFileType]: (
    base: LocalWidgetDraftBaseValues,
    now: number,
  ) => LocalWidgetDraftByType<T>;
};

const LOCAL_WIDGET_DRAFT_PARSERS = {
  [WIDGET_TYPE.MEMO]: (
    value: Readonly<Record<string, unknown>>,
    base: LocalWidgetDraftBaseValues,
  ) =>
    typeof value.markdown === "string"
      ? { ...base, type: WIDGET_TYPE.MEMO, markdown: value.markdown }
      : null,
  [WIDGET_TYPE.DAILY_CHECKLIST]: (
    value: Readonly<Record<string, unknown>>,
    base: LocalWidgetDraftBaseValues,
  ) => {
    if (
      typeof value.businessDate !== "string" ||
      !Array.isArray(value.items) ||
      value.items.length > MAX_ACTIVE_CHECKLIST_ITEMS ||
      !value.items.every(isChecklistItem)
    ) {
      return null;
    }
    return {
      ...base,
      type: WIDGET_TYPE.DAILY_CHECKLIST,
      businessDate: value.businessDate,
      items: value.items.map((item) => ({
        id: item.id as string,
        label: item.label as string,
        checked: item.checked as boolean,
      })),
    };
  },
} satisfies LocalWidgetDraftParserMap;

const LOCAL_WIDGET_DRAFT_FACTORIES = {
  [WIDGET_TYPE.MEMO]: (base: LocalWidgetDraftBaseValues) => ({
    ...base,
    type: WIDGET_TYPE.MEMO,
    markdown: "",
  }),
  [WIDGET_TYPE.DAILY_CHECKLIST]: (
    base: LocalWidgetDraftBaseValues,
    now: number,
  ) => ({
    ...base,
    type: WIDGET_TYPE.DAILY_CHECKLIST,
    businessDate: getKoreaDateContext(now).businessDate,
    items: [],
  }),
} satisfies LocalWidgetDraftFactoryMap;

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
  const type = WIDGET_FILE_TYPE_VALUES.find(
    (candidate) => candidate === value.type,
  );
  if (type === undefined) return null;
  const base: LocalWidgetDraftBaseValues = {
    version: LOCAL_WIDGET_DRAFT_VERSION,
    id: value.id,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  return localWidgetDraftParser(type)(value, base);
}

export function createLocalWidgetDraft<T extends WidgetFileType>(
  type: T,
  id: string,
  now: number,
): LocalWidgetDraftByType<T> {
  const timestamp = new Date(now).toISOString();
  return localWidgetDraftFactory(type)(
    {
      version: LOCAL_WIDGET_DRAFT_VERSION,
      id,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    now,
  );
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

function localWidgetDraftParser<T extends WidgetFileType>(
  type: T,
): LocalWidgetDraftParserMap[T] {
  return LOCAL_WIDGET_DRAFT_PARSERS[type] as LocalWidgetDraftParserMap[T];
}

function localWidgetDraftFactory<T extends WidgetFileType>(
  type: T,
): LocalWidgetDraftFactoryMap[T] {
  return LOCAL_WIDGET_DRAFT_FACTORIES[type] as LocalWidgetDraftFactoryMap[T];
}
