import { assertNever } from "@/domain/shared/assert-never";
import { isChecklistRepeatCycle } from "@/domain/widgets/checklist-period";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { toWidgetLayout } from "@/domain/widgets/widget-layout";
import type {
  ChecklistItem,
  DailyChecklistData,
  DashboardWidget,
  MemoData,
  WidgetByType,
  WidgetType,
} from "@/types/widgets/widget";

interface WidgetDataStrategy<TData> {
  readonly isData: (value: unknown) => value is TData;
  readonly cloneData: (data: TData) => TData;
  readonly supportsFileReference: boolean;
}

type WidgetDataStrategyMap = {
  readonly [T in WidgetType]: WidgetDataStrategy<WidgetByType<T>["data"]>;
};

const STATELESS_WIDGET_DATA_STRATEGY = {
  isData: (value: unknown): value is null => value === null,
  cloneData: (): null => null,
  supportsFileReference: false,
} satisfies WidgetDataStrategy<null>;

const WIDGET_DATA_STRATEGIES: WidgetDataStrategyMap = {
  [WIDGET_TYPE.MEMO]: {
    isData: isMemoData,
    cloneData: (data: MemoData): MemoData => ({ ...data }),
    supportsFileReference: true,
  },
  [WIDGET_TYPE.DAILY_CHECKLIST]: {
    isData: isDailyChecklistData,
    cloneData: (data: DailyChecklistData): DailyChecklistData => ({
      ...data,
      items: data.items.map((item) => ({ ...item })),
    }),
    supportsFileReference: true,
  },
  [WIDGET_TYPE.STORAGE_STATUS]: STATELESS_WIDGET_DATA_STRATEGY,
  [WIDGET_TYPE.IMAGE_UPLOAD_PROFILES]: STATELESS_WIDGET_DATA_STRATEGY,
  [WIDGET_TYPE.ADMIN]: STATELESS_WIDGET_DATA_STRATEGY,
};

export function cloneDashboardWidget<T extends DashboardWidget>(widget: T): WidgetByType<T["type"]>;
export function cloneDashboardWidget(widget: DashboardWidget): DashboardWidget {
  const base = { ...toWidgetLayout(widget), file: widget.file ? { ...widget.file } : null };
  switch (widget.type) {
    case WIDGET_TYPE.MEMO:
      return { ...base, type: widget.type, data: WIDGET_DATA_STRATEGIES[widget.type].cloneData(widget.data) };
    case WIDGET_TYPE.DAILY_CHECKLIST:
      return { ...base, type: widget.type, data: WIDGET_DATA_STRATEGIES[widget.type].cloneData(widget.data) };
    case WIDGET_TYPE.STORAGE_STATUS:
    case WIDGET_TYPE.IMAGE_UPLOAD_PROFILES:
    case WIDGET_TYPE.ADMIN:
      return { ...base, type: widget.type, file: null, data: null };
    default:
      return assertNever(widget);
  }
}

export function cloneDashboardWidgets(
  widgets: readonly DashboardWidget[],
): DashboardWidget[] {
  return widgets.map(cloneDashboardWidget);
}

export function isWidgetDataForType<T extends WidgetType>(
  type: T,
  value: unknown,
): value is WidgetByType<T>["data"] {
  return WIDGET_DATA_STRATEGIES[type].isData(value);
}

export function widgetTypeSupportsFileReference(type: WidgetType): boolean {
  return WIDGET_DATA_STRATEGIES[type].supportsFileReference;
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
    (value.repeatCycle === undefined || isChecklistRepeatCycle(value.repeatCycle)) &&
    Array.isArray(value.items) &&
    value.items.every(isChecklistItem)
  );
}

export function isChecklistItem(value: unknown): value is ChecklistItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.checked === "boolean" &&
    (value.checkedAt === undefined || value.checkedAt === null || (typeof value.checkedAt === "string" && Number.isFinite(Date.parse(value.checkedAt))))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
