import { useCallback } from "react";
import { MESSAGE_KIND } from "@client/constants/widgets/dashboard";
import { useDashboardLayoutSave } from "@client/hooks/widgets/use-dashboard-layout-save";
import { useDashboardState } from "@client/hooks/widgets/use-dashboard-state";
import { useDashboardWidgetCollection } from "@client/hooks/widgets/use-dashboard-widget-collection";
import { useWidgetLifecycleCommands } from "@client/hooks/widgets/use-widget-lifecycle-commands";
import { useWidgetWindowCommands } from "@client/hooks/widgets/use-widget-window-commands";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { DashboardController } from "@client/types/widgets/dashboard";
import type { SessionInfo } from "@/types/platform/auth";

export function useDashboard(
  api: DashboardGateway,
  initialSession?: SessionInfo,
): DashboardController {
  const {
    state,
    widgetsRef,
    replaceWidgets,
    setMessage,
    showError,
    dismissMessage,
    retryLoad,
  } = useDashboardState(api, initialSession);
  const layoutSave = useDashboardLayoutSave(api, {
    widgetsRef,
    replaceWidgets,
  });
  const collection = useDashboardWidgetCollection({
    widgetsRef,
    replaceWidgets,
    scheduleLayoutSave: layoutSave.schedule,
    forgetLayouts: layoutSave.forget,
  });
  const reportMessage = useCallback(
    (message: string): void =>
      setMessage({ kind: MESSAGE_KIND.ERROR, text: message }),
    [setMessage],
  );
  const lifecycle = useWidgetLifecycleCommands({
    gateway: api,
    collection,
    reportError: showError,
    reportMessage,
  });
  const windows = useWidgetWindowCommands(collection, state.widgets);

  return {
    state,
    layoutSave,
    ...lifecycle,
    ...windows,
    gateway: api,
    retry: retryLoad,
    dismissMessage,
  };
}
