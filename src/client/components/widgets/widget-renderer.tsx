import { lazy } from "react";
import type { ComponentType } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { WidgetType } from "@/types/widgets/widget";
import type { WidgetComponentProps } from "@client/types/desktop/desktop";
import { LazyFeatureBoundary } from "@client/components/shared/lazy-feature-boundary";
import { WIDGET_TITLE_BY_TYPE } from "@client/constants/widgets/content";

const MemoWidget = lazy(() =>
  import("@client/components/widgets/memo-widget").then((module) => ({
    default: module.MemoWidget,
  })),
);
const DailyChecklistWidget = lazy(() =>
  import("@client/components/widgets/daily-checklist-widget").then((module) => ({
    default: module.DailyChecklistWidget,
  })),
);
const StorageStatusWidget = lazy(() =>
  import("@client/components/widgets/storage-status-widget").then((module) => ({
    default: module.StorageStatusWidget,
  })),
);

const WIDGET_COMPONENTS = {
  [WIDGET_TYPE.MEMO]: MemoWidget,
  [WIDGET_TYPE.DAILY_CHECKLIST]: DailyChecklistWidget,
  [WIDGET_TYPE.STORAGE_STATUS]: StorageStatusWidget,
} satisfies Record<WidgetType, ComponentType<WidgetComponentProps>>;

export function WidgetRenderer(props: WidgetComponentProps) {
  const Component = WIDGET_COMPONENTS[props.widget.type];
  return (
    <LazyFeatureBoundary title={WIDGET_TITLE_BY_TYPE[props.widget.type]}>
      <Component {...props} />
    </LazyFeatureBoundary>
  );
}
