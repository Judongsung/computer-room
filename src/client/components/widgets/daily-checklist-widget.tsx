import { useState } from "react";
import { ChecklistRepeatDialog } from "@client/components/desktop/checklist/checklist-repeat-dialog";
import { CHECKLIST_REPEAT_COPY } from "@client/content/ko/widgets/checklist-repeat";
import { ProgramStatusBar } from "@client/components/desktop/application/program-status-bar";
import { PROGRAM_DOCUMENT_COPY as COPY } from "@client/content/ko/desktop/program-documents";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { DailyChecklistWidget as DailyChecklistWidgetData } from "@/types/widgets/widget";
import { DailyChecklistContent } from "@client/components/widgets/checklist/daily-checklist-content";
import { DailyChecklistToolbar } from "@client/components/widgets/checklist/daily-checklist-toolbar";
import { ChecklistLogDialog } from "@client/components/widgets/checklist-log-dialog";
import { WidgetCard } from "@client/components/widgets/widget-card";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { CHECKLIST_WIDGET_COPY } from "@client/content/ko/widgets/content";
import { useDailyChecklistController } from "@client/hooks/widgets/checklist/use-daily-checklist-controller";
import type { WidgetComponentProps } from "@client/types/desktop/desktop";

export function DailyChecklistWidget(props: WidgetComponentProps) {
  if (props.widget.type !== WIDGET_TYPE.DAILY_CHECKLIST) {
    return null;
  }
  return <DailyChecklistWidgetView {...props} widget={props.widget} />;
}

type DailyChecklistWidgetViewProps = Omit<WidgetComponentProps, "widget"> & {
  readonly widget: DailyChecklistWidgetData;
};

function DailyChecklistWidgetView({
  widget,
  windowControls,
  gateway,
  onWidgetChange,
}: DailyChecklistWidgetViewProps) {
  const [showRepeat, setShowRepeat] = useState(false);
  const controller = useDailyChecklistController({
    widget,
    gateway,
    onWidgetChange,
  });

  return (
    <>
      <WidgetCard
        className="desktop-program desktop-program--checklist"
        bodyClassName="desktop-program-body"
        footer={<ProgramStatusBar
          primary={COPY.COMPLETED(widget.data.items.filter((item) => item.checked).length, widget.data.items.length)}
          secondary={controller.isMutating ? COPY.SAVING : controller.isEditingItems ? COPY.EDITING : CHECKLIST_REPEAT_COPY.LABELS[widget.data.repeatCycle ?? "daily"]}
        />}
        title={widget.file?.name ?? CHECKLIST_WIDGET_COPY.UNSAVED_TITLE}
        iconPath={WIDGET_ICON_PATH_BY_TYPE[WIDGET_TYPE.DAILY_CHECKLIST]}
        windowControls={windowControls}
        toolbarActions={<DailyChecklistToolbar controller={controller} onOpenRepeat={() => setShowRepeat(true)} />}
      >
        <DailyChecklistContent data={widget.data} controller={controller} />
      </WidgetCard>

      {showRepeat ? <ChecklistRepeatDialog data={widget.data} controller={controller} onClose={() => setShowRepeat(false)} /> : null}
      {controller.showLogs ? (
        <ChecklistLogDialog
          widgetId={widget.id}
          gateway={gateway}
          onClose={controller.closeLogs}
        />
      ) : null}
    </>
  );
}
