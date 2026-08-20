import { EMPTY_MEMO_MARKDOWN } from "../constants/memo";
import { WIDGET_TYPE } from "../constants/widget";
import { WIDGET_ERRORS } from "../constants/errors/widget";
import { AppError } from "../domain/errors";
import { getKoreaDateContext } from "../domain/korea-date";
import { validateWidgetLayout } from "../domain/widget-layout-validation";
import type { ChecklistRepository } from "../types/checklist-repository";
import type { MemoRepository } from "../types/memo-repository";
import type { Clock } from "../types/runtime";
import type { DashboardWidget, WidgetLayout } from "../types/widget";
import type { WidgetLayoutRepository } from "../types/widget-repository";
import type { WidgetLayoutUseCases } from "../types/widget-service";

export class WidgetLayoutService implements WidgetLayoutUseCases {
  constructor(
    private readonly layouts: WidgetLayoutRepository,
    private readonly memos: MemoRepository,
    private readonly checklists: ChecklistRepository,
    private readonly clock: Clock,
  ) {}

  async listWidgets(): Promise<DashboardWidget[]> {
    const { businessDate, nextResetAt } = getKoreaDateContext(this.clock.now());
    const [layouts, memos, checklistItems] = await Promise.all([
      this.layouts.list(),
      this.memos.listAll(),
      this.checklists.listAllActiveItems(businessDate),
    ]);
    const memoByWidgetId = new Map(
      memos.map((memo) => [memo.widgetId, memo] as const),
    );
    const checklistItemsByWidgetId = new Map<
      string,
      typeof checklistItems
    >();
    for (const item of checklistItems) {
      const items = checklistItemsByWidgetId.get(item.widgetId) ?? [];
      items.push(item);
      checklistItemsByWidgetId.set(item.widgetId, items);
    }

    return layouts.map((layout): DashboardWidget => {
      if (layout.type === WIDGET_TYPE.MEMO) {
        const memo = memoByWidgetId.get(layout.id);
        return {
          ...layout,
          type: WIDGET_TYPE.MEMO,
          data: {
            markdown: memo?.markdown ?? EMPTY_MEMO_MARKDOWN,
            updatedAt:
              memo?.updatedAt === null || memo?.updatedAt === undefined
                ? null
                : new Date(memo.updatedAt).toISOString(),
          },
        };
      }

      return {
        ...layout,
        type: WIDGET_TYPE.DAILY_CHECKLIST,
        data: {
          businessDate,
          nextResetAt: new Date(nextResetAt).toISOString(),
          items: (checklistItemsByWidgetId.get(layout.id) ?? []).map(
            toChecklistItem,
          ),
        },
      };
    });
  }

  async replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<DashboardWidget[]> {
    const validatedWidgets = validateWidgetLayout(widgets);
    const existingWidgets = await this.layouts.list();
    const existingTypeById = new Map(
      existingWidgets.map((widget) => [widget.id, widget.type] as const),
    );
    for (const widget of validatedWidgets) {
      const existingType = existingTypeById.get(widget.id);
      if (existingType !== undefined && existingType !== widget.type) {
        throw new AppError(WIDGET_ERRORS.WIDGET_TYPE_CHANGE_NOT_ALLOWED);
      }
    }

    await this.layouts.synchronize(validatedWidgets);
    return this.listWidgets();
  }
}

function toChecklistItem(item: {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
}) {
  return { id: item.id, label: item.label, checked: item.checked };
}
