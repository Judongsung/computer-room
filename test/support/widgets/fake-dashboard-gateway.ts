import { CHECKLIST_EVENT_ACTION } from "@/constants/widgets/checklist";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import {
  WIDGET_BEHAVIOR,
  WIDGET_TYPE,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import { cloneDashboardWidgets } from "@/domain/widgets/widget-layout";
import type { SessionInfo } from "@/types/platform/auth";
import type { ChecklistItem, ChecklistLogEvent, ChecklistLogPage, DailyChecklistData, DashboardWidget, CreateWidgetInput, MemoData, WidgetLayout } from "@/types/widgets/widget";
import type { FilesystemWidgetEntry, SaveWidgetFileInput } from "@/types/filesystem/filesystem";
import type { DashboardGateway } from "@client/types/widgets/api";
import { SESSION } from "@test/support/desktop/app-test-session";

export class FakeDashboardGateway implements DashboardGateway {
  savedWidgets: DashboardWidget[] = [];
  layoutSaveFailures = 0;
  readonly layoutSaveCalls: WidgetLayout[][] = [];
  readonly checklistLabels = new Map<string, string>();
  readonly checklistLogs: ChecklistLogEvent[] = [];
  private nextChecklistItem = 1;
  private nextLayoutSaveGate: Promise<void> | null = null;
  private nextWidget = 1;

  async getSession(): Promise<SessionInfo> {
    return SESSION;
  }

  async listWidgets(): Promise<DashboardWidget[]> {
    return cloneDashboardWidgets(this.savedWidgets);
  }

  async replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<DashboardWidget[]> {
    this.layoutSaveCalls.push(
      widgets.map((widget) => ({
        ...widget,
        position: { ...widget.position },
        size: { ...widget.size },
      })),
    );
    if (this.nextLayoutSaveGate) {
      const gate = this.nextLayoutSaveGate;
      this.nextLayoutSaveGate = null;
      await gate;
    }
    if (this.layoutSaveFailures > 0) {
      this.layoutSaveFailures -= 1;
      throw new Error("테스트 저장 실패");
    }
    const existingById = new Map(
      this.savedWidgets.map((widget) => [widget.id, widget] as const),
    );
    this.savedWidgets = widgets.map((layout): DashboardWidget => {
      const existing = existingById.get(layout.id);
      if (existing?.type === layout.type) {
        return mergeFakeWidgetLayout(existing, layout);
      }
      return fakeWidgetFromLayout(layout);
    });
    return cloneDashboardWidgets(this.savedWidgets);
  }

  async createWidget(input: CreateWidgetInput): Promise<DashboardWidget> {
    const id = `00000000-0000-4000-8000-${String(this.nextWidget).padStart(12, "0")}`;
    this.nextWidget += 1;
    const layout: WidgetLayout = {
      id,
      type: input.type,
      position: input.position,
      size: input.size,
      windowState: WINDOW_STATE.NORMAL,
      restoreState: WINDOW_RESTORE_STATE.NORMAL,
      stackOrder: this.savedWidgets.length,
    };
    const widget = fakeWidgetFromLayout(layout);
    this.savedWidgets.push(widget);
    return structuredClone(widget);
  }

  async saveWidgetFile(
    widgetId: string,
    input: SaveWidgetFileInput,
  ): Promise<{ widget: DashboardWidget; entry: FilesystemWidgetEntry }> {
    const widget = this.savedWidgets.find((candidate) => candidate.id === widgetId);
    if (!widget) throw new Error("Widget not found");
    if (
      !WIDGET_BEHAVIOR[widget.type].supportsFileStorage ||
      (widget.type !== WIDGET_TYPE.MEMO &&
        widget.type !== WIDGET_TYPE.DAILY_CHECKLIST)
    ) {
      throw new Error("Widget file storage is not supported");
    }
    const entry: FilesystemWidgetEntry = {
      id: `widget-file-${widgetId}`,
      parentId: input.parentId,
      kind: FILESYSTEM_ENTRY_KIND.WIDGET,
      name: input.name,
      widgetId,
      widgetType: widget.type,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      desktopOrder: null,
    };
    const saved = { ...widget, file: { entryId: entry.id, parentId: input.parentId, name: input.name } };
    this.savedWidgets = this.savedWidgets.map((candidate) =>
      candidate.id === widgetId ? saved : candidate,
    );
    return { widget: saved, entry };
  }

  async openWidget(widgetId: string): Promise<DashboardWidget> {
    const widget = this.savedWidgets.find((candidate) => candidate.id === widgetId);
    if (!widget) throw new Error("Widget not found");
    return structuredClone(widget);
  }

  async closeWidget(_widgetId: string): Promise<void> {}

  async discardWidget(widgetId: string): Promise<void> {
    this.savedWidgets = this.savedWidgets.filter((widget) => widget.id !== widgetId);
  }

  async updateMemo(widgetId: string, markdown: string): Promise<MemoData> {
    const data = { markdown, updatedAt: "2026-08-20T01:00:00.000Z" };
    this.savedWidgets = this.savedWidgets.map((widget) =>
      widget.id === widgetId && widget.type === WIDGET_TYPE.MEMO
        ? { ...widget, data }
        : widget,
    );
    return data;
  }

  async getChecklist(widgetId: string): Promise<DailyChecklistData> {
    const widget = this.savedWidgets.find(
      (candidate) =>
        candidate.id === widgetId &&
        candidate.type === WIDGET_TYPE.DAILY_CHECKLIST,
    );
    if (!widget || widget.type !== WIDGET_TYPE.DAILY_CHECKLIST) {
      throw new Error("Checklist not found");
    }
    return widget.data;
  }

  async addChecklistItem(
    _widgetId: string,
    label: string,
  ): Promise<ChecklistItem> {
    const id = `00000000-0000-4000-8000-${String(this.nextChecklistItem).padStart(12, "0")}`;
    this.nextChecklistItem += 1;
    this.checklistLabels.set(id, label);
    this.addLog(id, label, null, CHECKLIST_EVENT_ACTION.ADDED);
    return { id, label, checked: false };
  }

  async updateChecklistItem(
    _widgetId: string,
    itemId: string,
    label: string,
  ): Promise<ChecklistItem> {
    const previousItemLabel = this.checklistLabels.get(itemId) ?? null;
    this.checklistLabels.set(itemId, label);
    this.addLog(
      itemId,
      label,
      previousItemLabel,
      CHECKLIST_EVENT_ACTION.RENAMED,
    );
    return { id: itemId, label, checked: false };
  }

  async deleteChecklistItem(_widgetId: string, itemId: string): Promise<void> {
    const itemLabel = this.checklistLabels.get(itemId) ?? "항목";
    this.checklistLabels.delete(itemId);
    this.addLog(itemId, itemLabel, null, CHECKLIST_EVENT_ACTION.DELETED);
  }

  async setChecklistItemChecked(
    _widgetId: string,
    itemId: string,
    checked: boolean,
  ): Promise<ChecklistItem> {
    const label = this.checklistLabels.get(itemId) ?? "항목";
    this.addLog(
      itemId,
      label,
      null,
      checked
        ? CHECKLIST_EVENT_ACTION.CHECKED
        : CHECKLIST_EVENT_ACTION.UNCHECKED,
    );
    return { id: itemId, label, checked };
  }

  async listChecklistLogs(): Promise<ChecklistLogPage> {
    return { items: [...this.checklistLogs], nextOffset: null };
  }

  blockNextLayoutSave(): () => void {
    let release = (): void => undefined;
    this.nextLayoutSaveGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  }

  private addLog(
    itemId: string,
    itemLabel: string,
    previousItemLabel: string | null,
    action: ChecklistLogEvent["action"],
  ): void {
    this.checklistLogs.unshift({
      id: `event-${this.checklistLogs.length + 1}`,
      itemId,
      itemLabel,
      previousItemLabel,
      action,
      businessDate: "2026-08-20",
      occurredAt: "2026-08-20T01:00:00.000Z",
    });
  }
}

export function fakeWidgetFromLayout(layout: WidgetLayout): DashboardWidget {
  if (layout.type === WIDGET_TYPE.MEMO) {
    return {
      ...layout,
      type: WIDGET_TYPE.MEMO,
      file: null,
      data: { markdown: "", updatedAt: null },
    };
  }
  if (layout.type === WIDGET_TYPE.STORAGE_STATUS) {
    return {
      ...layout,
      type: WIDGET_TYPE.STORAGE_STATUS,
      file: null,
      data: null,
    };
  }
  if (layout.type === WIDGET_TYPE.IMAGE_UPLOAD_PROFILES) {
    return {
      ...layout,
      type: WIDGET_TYPE.IMAGE_UPLOAD_PROFILES,
      file: null,
      data: null,
    };
  }
  return {
    ...layout,
    type: WIDGET_TYPE.DAILY_CHECKLIST,
    file: null,
    data: {
      businessDate: "2026-08-20",
      nextResetAt: "2026-08-20T15:00:00.000Z",
      items: [],
    },
  };
}

export function mergeFakeWidgetLayout(
  existing: DashboardWidget,
  layout: WidgetLayout,
): DashboardWidget {
  if (existing.type === WIDGET_TYPE.MEMO) {
    return { ...existing, ...layout, type: WIDGET_TYPE.MEMO };
  }
  if (existing.type === WIDGET_TYPE.STORAGE_STATUS) {
    return {
      ...existing,
      ...layout,
      type: WIDGET_TYPE.STORAGE_STATUS,
      file: null,
      data: null,
    };
  }
  if (existing.type === WIDGET_TYPE.IMAGE_UPLOAD_PROFILES) {
    return {
      ...existing,
      ...layout,
      type: WIDGET_TYPE.IMAGE_UPLOAD_PROFILES,
      file: null,
      data: null,
    };
  }
  return { ...existing, ...layout, type: WIDGET_TYPE.DAILY_CHECKLIST };
}
