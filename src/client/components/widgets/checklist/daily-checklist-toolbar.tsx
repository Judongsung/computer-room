import { CHECKLIST_REPEAT_COPY } from "@client/content/ko/widgets/checklist-repeat";
import { XpWidgetToolbarButton } from "@client/components/shared/xp-widget-toolbar-button";
import { XP_WIDGET_TOOLBAR_ACTION } from "@client/constants/shared/xp";
import { CHECKLIST_WIDGET_COPY } from "@client/content/ko/widgets/content";
import type { DailyChecklistController } from "@client/types/widgets/daily-checklist";

interface DailyChecklistToolbarProps {
  readonly onOpenRepeat: () => void;
  readonly controller: DailyChecklistController;
}

export function DailyChecklistToolbar({
  controller,
  onOpenRepeat,
}: DailyChecklistToolbarProps) {
  return (
    <>
      <XpWidgetToolbarButton action={XP_WIDGET_TOOLBAR_ACTION.REFRESH} label={CHECKLIST_REPEAT_COPY.TITLE} onClick={onOpenRepeat} disabled={controller.isMutating} />
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
