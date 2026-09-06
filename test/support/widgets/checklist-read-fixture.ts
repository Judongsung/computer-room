import type { ChecklistRepeatCycle } from "@/constants/widgets/checklist-repeat";
import { WIDGET_TYPE, WIDGET_WINDOW_POLICY, WINDOW_RESTORE_STATE, WINDOW_STATE } from "@/constants/widgets/widget";
import type { StoredWidgetLayout } from "@/types/widgets/widget";
import { StaticClock } from "@test/support/platform/runtime-fakes";
import { MemoryChecklistRepository } from "@test/support/widgets/memory-checklist-repository";
import { MemoryWidgetLayoutRepository } from "@test/support/widgets/memory-widget-repositories";

export const CHECKLIST_READ_BOUNDARIES = [
  { cycle: "daily", before: "2026-09-06T14:59:59.000Z", boundary: "2026-09-06T15:00:00.000Z", businessDate: "2026-09-06" },
  { cycle: "weekly", before: "2026-09-06T14:59:59.000Z", boundary: "2026-09-06T15:00:00.000Z", businessDate: "2026-09-06" },
  { cycle: "monthly", before: "2026-09-30T14:59:59.000Z", boundary: "2026-09-30T15:00:00.000Z", businessDate: "2026-09-30" },
] as const;

export async function checklistReadFixture(
  before: string,
  businessDate: string,
  cycle?: ChecklistRepeatCycle,
) {
  const clock = new StaticClock(Date.parse(before));
  const layouts = new MemoryWidgetLayoutRepository();
  const checklists = new MemoryChecklistRepository();
  const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.DAILY_CHECKLIST];
  const widget = {
    id: "00000000-0000-4000-8000-000000000101",
    type: WIDGET_TYPE.DAILY_CHECKLIST,
    position: { x: 32, y: 32 },
    size: { width: policy.DEFAULT_WIDTH, height: policy.DEFAULT_HEIGHT },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
    stackOrder: 0,
    isOpen: true,
    file: null,
  } satisfies StoredWidgetLayout;
  layouts.records = [widget];
  if (cycle) checklists.repeatSettings.push({ widgetId: widget.id, repeatCycle: cycle, version: 0 });
  const item = { id: "item-1", widgetId: widget.id, label: "확인한 항목", sortOrder: 0, checked: false };
  checklists.items.push(item);
  await checklists.setChecked({
    eventId: "event-1", widgetId: widget.id, itemId: item.id, itemLabel: item.label,
    checked: true, businessDate, occurredAt: clock.timestamp,
  });
  const publicItem = { id: item.id, label: item.label, checked: true, checkedAt: before };
  return { clock, layouts, checklists, widget, publicItem };
}
