import { XpWidgetToolbarButton } from "@client/components/shared/xp-widget-toolbar-button";
import { XP_WIDGET_TOOLBAR_ACTION } from "@client/constants/shared/xp";
import { CHECKLIST_WIDGET_COPY } from "@client/content/ko/widgets/content";
import type { DailyChecklistController } from "@client/types/widgets/daily-checklist";

interface DailyChecklistToolbarProps {
  readonly controller: DailyChecklistController;
}

export function DailyChecklistToolbar({
  controller,
}: DailyChecklistToolbarProps) {
  return (
    <>
      <XpWidgetToolbarButton
        action={XP_WIDGET_TOOLBAR_ACTION.HISTORY}
        label={CHECKLIST_WIDGET_COPY.DETAILS}
        onClick={controller.openLogs}
      />
      <XpWidgetToolbarButton
        action={
          controller.isEditingItems
            ? XP_WIDGET_TOOLBAR_ACTION.COMPLETE
            : XP_WIDGET_TOOLBAR_ACTION.EDIT
        }
        label={
          controller.isEditingItems
            ? CHECKLIST_WIDGET_COPY.FINISH_EDITING
            : CHECKLIST_WIDGET_COPY.EDIT
        }
        onClick={controller.toggleEditing}
        disabled={controller.isMutating}
      />
    </>
  );
}
