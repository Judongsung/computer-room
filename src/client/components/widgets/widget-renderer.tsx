import type { ComponentType } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { WidgetType } from "@/types/widgets/widget";
import type { WidgetComponentProps } from "@client/types/desktop/desktop";
import { DailyChecklistWidget } from "@client/components/widgets/daily-checklist-widget";
import { MemoWidget } from "@client/components/widgets/memo-widget";
import { StorageStatusWidget } from "@client/components/widgets/storage-status-widget";

const WIDGET_COMPONENTS = {
  [WIDGET_TYPE.MEMO]: MemoWidget,
  [WIDGET_TYPE.DAILY_CHECKLIST]: DailyChecklistWidget,
  [WIDGET_TYPE.STORAGE_STATUS]: StorageStatusWidget,
} satisfies Record<WidgetType, ComponentType<WidgetComponentProps>>;

export function WidgetRenderer(props: WidgetComponentProps) {
  const Component = WIDGET_COMPONENTS[props.widget.type];
  return <Component {...props} />;
}
