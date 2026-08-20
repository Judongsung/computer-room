import { useState, type CSSProperties } from "react";
import { WIDGET_TYPE } from "../constants/widget";
import { DashboardApiClient } from "./api/dashboard-api-client";
import { DashboardToolbar } from "./components/dashboard/dashboard-toolbar";
import { WidgetBoard } from "./components/dashboard/widget-board";
import { SiteHeader } from "./components/site-header";
import {
  DASHBOARD_MODE,
  DASHBOARD_LAYOUT,
  DESKTOP_MEDIA_QUERY,
  LOAD_STATUS,
  MESSAGE_KIND,
  UI_MESSAGES,
} from "./constants/dashboard";
import { DASHBOARD_COPY, SITE_COPY } from "./constants/content";
import { useDashboard } from "./hooks/use-dashboard";
import { useMediaQuery } from "./hooks/use-media-query";
import type { DashboardGateway } from "./types/api";

interface AppProps {
  readonly api?: DashboardGateway;
}

const DASHBOARD_STYLE_VARIABLES = {
  "--dashboard-max-width": `${DASHBOARD_LAYOUT.MAX_WIDTH_PX}px`,
  "--dashboard-row-height": `${DASHBOARD_LAYOUT.ROW_HEIGHT_PX}px`,
  "--dashboard-grid-gap": `${DASHBOARD_LAYOUT.GAP_PX}px`,
} as CSSProperties;

export function App({ api }: AppProps) {
  const [gateway] = useState<DashboardGateway>(
    () => api ?? new DashboardApiClient(),
  );
  const dashboard = useDashboard(gateway);
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const { state } = dashboard;

  if (state.loadStatus === LOAD_STATUS.LOADING) {
    return (
      <main className="centered-state">
        <section className="state-window window" aria-busy="true">
          <div className="title-bar">
            <h1 className="title-bar-text">{SITE_COPY.TITLE}</h1>
          </div>
          <div className="window-body">
            <p>{UI_MESSAGES.LOADING}</p>
            <progress />
          </div>
        </section>
      </main>
    );
  }

  if (state.loadStatus === LOAD_STATUS.ERROR || !state.session) {
    return (
      <main className="centered-state">
        <section className="state-window window">
          <div className="title-bar">
            <h1 className="title-bar-text">{SITE_COPY.TITLE}</h1>
          </div>
          <div className="window-body state-window__body">
            <p role="alert">{state.message?.text}</p>
            <button type="button" onClick={dashboard.retry}>
              {DASHBOARD_COPY.RETRY}
            </button>
          </div>
        </section>
      </main>
    );
  }

  const isEditing = state.mode === DASHBOARD_MODE.EDIT;
  const widgets = isEditing ? state.draftWidgets : state.persistedWidgets;

  return (
    <div
      className={isDesktop ? "site-shell" : "site-shell site-shell--narrow"}
      style={DASHBOARD_STYLE_VARIABLES}
    >
      <SiteHeader session={state.session} />
      <main className="dashboard window">
        <div className="title-bar">
          <h2 className="title-bar-text">{DASHBOARD_COPY.TITLE}</h2>
        </div>
        <div className="dashboard__body window-body">
          <div className="dashboard-heading">
            <p>{DASHBOARD_COPY.DESCRIPTION}</p>
            <DashboardToolbar
              mode={state.mode}
              isDesktop={isDesktop}
              isDirty={dashboard.isDirty}
              isSaving={state.isSaving}
              onStartEditing={dashboard.startEditing}
              onAddMemoWidget={() => dashboard.addWidget(WIDGET_TYPE.MEMO)}
              onAddChecklistWidget={() =>
                dashboard.addWidget(WIDGET_TYPE.DAILY_CHECKLIST)
              }
              onSave={() => void dashboard.save()}
              onCancel={dashboard.cancelEditing}
            />
          </div>

          {state.message ? (
            <div
              className="status-bar status-message"
              role={
                state.message.kind === MESSAGE_KIND.ERROR ? "alert" : "status"
              }
            >
              <p className="status-bar-field">{state.message.text}</p>
            </div>
          ) : null}

          <WidgetBoard
            widgets={widgets}
            isDesktop={isDesktop}
            isEditing={isEditing}
            onLayoutChange={dashboard.replaceDraft}
            onDelete={dashboard.removeWidget}
            gateway={dashboard.gateway}
            onWidgetChange={dashboard.updateWidget}
          />
        </div>
      </main>
    </div>
  );
}
