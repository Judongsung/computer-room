import type { ComponentType } from "react";
import { WIDGET_TYPE } from "../../../constants/widget";
import type { DashboardWidget, WidgetType } from "../../../types/widget";
import type { DashboardGateway } from "../../types/api";
import { DailyChecklistWidget } from "./daily-checklist-widget";
import { MemoWidget } from "./memo-widget";

export interface WidgetComponentProps {
  readonly widget: DashboardWidget;
  readonly isEditingLayout: boolean;
  readonly onDelete: () => void;
  readonly gateway: DashboardGateway;
  readonly onWidgetChange: (widget: DashboardWidget) => void;
}

const WIDGET_COMPONENTS = {
  [WIDGET_TYPE.MEMO]: MemoWidget,
  [WIDGET_TYPE.DAILY_CHECKLIST]: DailyChecklistWidget,
} satisfies Record<WidgetType, ComponentType<WidgetComponentProps>>;

export function WidgetRenderer(props: WidgetComponentProps) {
  const Component = WIDGET_COMPONENTS[props.widget.type];
  return <Component {...props} />;
}
