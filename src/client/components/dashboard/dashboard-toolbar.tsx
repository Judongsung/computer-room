import { DASHBOARD_MODE, UI_MESSAGES } from "../../constants/dashboard";
import { DASHBOARD_COPY } from "../../constants/content";
import type { DashboardMode } from "../../types/dashboard";

interface DashboardToolbarProps {
  readonly mode: DashboardMode;
  readonly isDesktop: boolean;
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly onStartEditing: () => void;
  readonly onAddMemoWidget: () => void;
  readonly onAddChecklistWidget: () => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

export function DashboardToolbar({
  mode,
  isDesktop,
  isDirty,
  isSaving,
  onStartEditing,
  onAddMemoWidget,
  onAddChecklistWidget,
  onSave,
  onCancel,
}: DashboardToolbarProps) {
  if (!isDesktop) {
    return <p className="viewport-notice">{UI_MESSAGES.MOBILE_EDIT_NOTICE}</p>;
  }

  if (mode === DASHBOARD_MODE.VIEW) {
    return (
      <div className="dashboard-toolbar field-row">
        <button type="button" onClick={onStartEditing}>
          {DASHBOARD_COPY.EDIT}
        </button>
      </div>
    );
  }

  return (
    <div
      className="dashboard-toolbar field-row"
      aria-label={DASHBOARD_COPY.EDIT_TOOLS_LABEL}
    >
      <button type="button" onClick={onAddMemoWidget} disabled={isSaving}>
        {DASHBOARD_COPY.ADD_MEMO_WIDGET}
      </button>
      <button type="button" onClick={onAddChecklistWidget} disabled={isSaving}>
        {DASHBOARD_COPY.ADD_CHECKLIST_WIDGET}
      </button>
      <span className="toolbar-spacer" />
      <button type="button" onClick={onSave} disabled={!isDirty || isSaving}>
        {isSaving ? DASHBOARD_COPY.SAVING : DASHBOARD_COPY.SAVE}
      </button>
      <button
        className="secondary-button"
        type="button"
        onClick={onCancel}
        disabled={isSaving}
      >
        {DASHBOARD_COPY.CANCEL}
      </button>
    </div>
  );
}
