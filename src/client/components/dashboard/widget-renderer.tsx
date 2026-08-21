import type { ComponentType } from "react";
import { WIDGET_TYPE } from "../../../constants/widget";
import type { WidgetType } from "../../../types/widget";
import type { WidgetComponentProps } from "../../types/desktop";
import { DailyChecklistWidget } from "./daily-checklist-widget";
import { MemoWidget } from "./memo-widget";

const WIDGET_COMPONENTS = {
  [WIDGET_TYPE.MEMO]: MemoWidget,
  [WIDGET_TYPE.DAILY_CHECKLIST]: DailyChecklistWidget,
} satisfies Record<WidgetType, ComponentType<WidgetComponentProps>>;

export function WidgetRenderer(props: WidgetComponentProps) {
  const Component = WIDGET_COMPONENTS[props.widget.type];
  return <Component {...props} />;
}
