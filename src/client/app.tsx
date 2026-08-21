import { useState, type CSSProperties } from "react";
import { DesktopShell } from "./components/desktop/desktop-shell";
import { XpWindowFrame } from "./components/desktop/xp-window-frame";
import { DASHBOARD_COPY, SITE_COPY } from "./constants/content";
import { LOAD_STATUS, UI_MESSAGES } from "./constants/dashboard";
import { DESKTOP_ASSET_PATHS } from "./constants/desktop";
import { useDashboard } from "./hooks/use-dashboard";
import { DashboardApiClient } from "./api/dashboard-api-client";
import type { AppProps } from "./types/app";
import type { DashboardGateway } from "./types/api";

const DESKTOP_BACKGROUND_STYLE = {
  "--desktop-background-image": `url("${DESKTOP_ASSET_PATHS.BACKGROUND}")`,
} as CSSProperties;

export function App({ api }: AppProps) {
  const [gateway] = useState<DashboardGateway>(
    () => api ?? new DashboardApiClient(),
  );
  const dashboard = useDashboard(gateway);
  const { state } = dashboard;

  if (state.loadStatus === LOAD_STATUS.LOADING) {
    return (
      <main className="desktop-state" style={DESKTOP_BACKGROUND_STYLE}>
        <XpWindowFrame
          className="state-window"
          title={SITE_COPY.TITLE}
          iconPath={DESKTOP_ASSET_PATHS.START_LOGO}
          bodyClassName="state-window__body"
          aria-busy="true"
        >
          <p>{state.message?.text ?? UI_MESSAGES.LOADING}</p>
          <progress />
        </XpWindowFrame>
      </main>
    );
  }

  if (state.loadStatus === LOAD_STATUS.ERROR || !state.session) {
    return (
      <main className="desktop-state" style={DESKTOP_BACKGROUND_STYLE}>
        <XpWindowFrame
          className="state-window"
          title={SITE_COPY.TITLE}
          iconPath={DESKTOP_ASSET_PATHS.START_LOGO}
          bodyClassName="state-window__body"
        >
          <p role="alert">{state.message?.text}</p>
          <button type="button" onClick={dashboard.retry}>
            {DASHBOARD_COPY.RETRY}
          </button>
        </XpWindowFrame>
      </main>
    );
  }

  return (
    <DesktopShell
      session={state.session}
      widgets={state.widgets}
      activeWidgetId={dashboard.activeWidgetId}
      gateway={dashboard.gateway}
      layoutSaveStatus={dashboard.layoutSave.status}
      layoutSaveError={dashboard.layoutSave.error}
      message={state.message}
      onAddWidget={dashboard.addWidget}
      onFocusWindow={dashboard.focusWindow}
      onMinimizeWindow={dashboard.minimizeWindow}
      onToggleMaximizeWindow={dashboard.toggleMaximizeWindow}
      onActivateTaskbarWindow={dashboard.activateTaskbarWindow}
      onCommitWindowBounds={dashboard.commitWindowBounds}
      onWidgetChange={dashboard.updateWidget}
      onRetrySave={dashboard.layoutSave.retry}
      onDismissMessage={dashboard.dismissMessage}
    />
  );
}
