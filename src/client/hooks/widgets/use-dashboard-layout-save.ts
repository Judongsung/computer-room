import { useCallback, useMemo, type RefObject } from "react";
import type { DashboardWidget } from "@/types/widgets/widget";
import { UI_MESSAGES } from "@client/content/ko/widgets/dashboard";
import { mergeSavedDashboardWidgetMetadata } from "@client/domain/widgets/dashboard-sync";
import { useUnsavedChangesWarning } from "@client/hooks/shared/use-unsaved-changes-warning";
import { useWidgetLayoutAutoSave } from "@client/hooks/widgets/use-widget-layout-auto-save";
import type { WidgetLayoutAutoSaveController } from "@client/types/widgets/dashboard";
import type { WidgetLayoutGateway } from "@client/types/widgets/ports/layout";

interface UseDashboardLayoutSaveOptions {
  readonly widgetsRef: RefObject<readonly DashboardWidget[]>;
  readonly replaceWidgets: (widgets: readonly DashboardWidget[]) => void;
}

export function useDashboardLayoutSave(
  gateway: WidgetLayoutGateway,
  { widgetsRef, replaceWidgets }: UseDashboardLayoutSaveOptions,
): WidgetLayoutAutoSaveController {
  const mergeSavedWidgetMetadata = useCallback(
    (savedWidgets: readonly DashboardWidget[]): void => {
      replaceWidgets(
        mergeSavedDashboardWidgetMetadata(widgetsRef.current, savedWidgets),
      );
    },
    [replaceWidgets, widgetsRef],
  );
  const layoutSaveOptions = useMemo(
    () => ({
      fallbackErrorMessage: UI_MESSAGES.SAVE_FAILED,
      onSaved: mergeSavedWidgetMetadata,
    }),
    [mergeSavedWidgetMetadata],
  );
  const layoutSave = useWidgetLayoutAutoSave(gateway, layoutSaveOptions);
  useUnsavedChangesWarning(layoutSave.hasUnsavedChanges);
  return layoutSave;
}
