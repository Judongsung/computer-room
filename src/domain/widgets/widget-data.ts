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

const WIDGET_DATA_STRATEGIES = {
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
} satisfies WidgetDataStrategyMap;

export function cloneDashboardWidget<T extends DashboardWidget>(widget: T): T {
  const strategy = widgetDataStrategy(widget.type);
  return {
    ...toWidgetLayout(widget),
    type: widget.type,
    file: widget.file ? { ...widget.file } : null,
    data: strategy.cloneData(widget.data),
  } as T;
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
  return widgetDataStrategy(type).isData(value);
}

export function widgetTypeSupportsFileReference(type: WidgetType): boolean {
  return widgetDataStrategy(type).supportsFileReference;
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

function widgetDataStrategy<T extends WidgetType>(
  type: T,
): WidgetDataStrategy<WidgetByType<T>["data"]> {
  return WIDGET_DATA_STRATEGIES[type] as unknown as WidgetDataStrategy<
    WidgetByType<T>["data"]
  >;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
