import { toChecklistData } from "@/application/widgets/checklist-data-mapper";
import { EMPTY_MEMO_MARKDOWN } from "@/constants/widgets/memo";
import { WIDGET_ERRORS } from "@/constants/widgets/errors/widget";
import {
  MAX_OPEN_WIDGET_COUNT,
  WIDGET_BEHAVIOR,
  WIDGET_TYPE,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import { AppError } from "@/domain/shared/errors";
import { getKoreaDateContext } from "@/domain/shared/korea-date";
import { validateWidgetLayout } from "@/domain/widgets/widget-layout-validation";
import {
  normalizeWidgetStackOrders,
  widgetLayoutsEqual,
} from "@/domain/widgets/widget-layout";
import type { ChecklistRepository } from "@/types/widgets/checklist-repository";
import type { MemoRepository } from "@/types/widgets/memo-repository";
import type { Clock, IdGenerator } from "@/types/platform/runtime";
import type {
  CreateWidgetInput,
  DashboardWidget,
  StoredWidgetLayout,
  WidgetLayout,
  WidgetCreationResult,
  WidgetType,
} from "@/types/widgets/widget";
import type { WidgetLayoutRepository } from "@/types/widgets/widget-repository";
import type { WidgetLayoutUseCases } from "@/types/widgets/widget-service";

export class WidgetLayoutService implements WidgetLayoutUseCases {
  constructor(
    private readonly layouts: WidgetLayoutRepository,
    private readonly memos: MemoRepository,
    private readonly checklists: ChecklistRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async listWidgets(): Promise<DashboardWidget[]> {
    const openLayouts = await this.layouts.list();
    const restorableLayouts = openLayouts.filter(
      (layout) => WIDGET_BEHAVIOR[layout.type].persistsOpenState,
    );
    const staleSessionLayouts = openLayouts.filter(
      (layout) => !WIDGET_BEHAVIOR[layout.type].persistsOpenState,
    );
    const normalizedLayouts = normalizeWidgetStackOrders(restorableLayouts);
    await Promise.all([
      ...staleSessionLayouts.map((layout) =>
        this.layouts.setOpen(layout.id, false),
      ),
      ...(widgetLayoutsEqual(restorableLayouts, normalizedLayouts)
        ? []
        : [this.layouts.synchronize(normalizedLayouts)]),
    ]);
    return this.hydrate(normalizedLayouts);
  }

  async getWidget(widgetId: string): Promise<DashboardWidget> {
    return this.hydrateOne(await this.requireWidget(widgetId));
  }

  async replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<DashboardWidget[]> {
    const validatedWidgets = validateWidgetLayout(widgets);
    const existingWidgets = await Promise.all(
      validatedWidgets.map((widget) => this.layouts.findById(widget.id)),
    );
    const existingById = new Map(
      existingWidgets.flatMap((widget) =>
        widget ? [[widget.id, widget] as const] : [],
      ),
    );
    for (const widget of validatedWidgets) {
      const existing = existingById.get(widget.id);
      if (existing === undefined) {
        throw new AppError(WIDGET_ERRORS.WIDGET_NOT_FOUND);
      }
      if (existing.type !== widget.type) {
        throw new AppError(WIDGET_ERRORS.WIDGET_TYPE_CHANGE_NOT_ALLOWED);
      }
    }

    await this.layouts.synchronize(validatedWidgets);
    return this.hydrate(
      validatedWidgets.map((widget) => {
        const existing = existingById.get(widget.id);
        if (!existing) {
          throw new AppError(WIDGET_ERRORS.WIDGET_NOT_FOUND);
        }
        return {
          ...widget,
          isOpen: existing.isOpen,
          file: existing.file,
        };
      }),
    );
  }

  async createWidget(input: CreateWidgetInput): Promise<WidgetCreationResult> {
    const behavior = WIDGET_BEHAVIOR[input.type];
    if (behavior.singleton) {
      const existing = await this.layouts.findByType(input.type);
      if (existing) {
        if (!behavior.persistsOpenState) {
          if (existing.isOpen) {
            await this.layouts.setOpen(existing.id, false);
          }
          await this.assertOpenCapacity();
        } else if (!existing.isOpen) {
          await this.assertOpenCapacity();
          await this.layouts.setOpen(existing.id, true);
        }
        return {
          widget: await this.hydrateOne({ ...existing, isOpen: true }),
          created: false,
        };
      }
    }
    await this.assertOpenCapacity();
    const openWidgets = await this.layouts.list();
    const layout = validateWidgetLayout([
      {
        id: this.ids.generate(),
        type: input.type,
        position: input.position,
        size: input.size,
        windowState: WINDOW_STATE.NORMAL,
        restoreState: WINDOW_RESTORE_STATE.NORMAL,
        stackOrder:
          Math.max(-1, ...openWidgets.map((widget) => widget.stackOrder)) + 1,
      },
    ])[0];
    if (!layout) {
      throw new AppError(WIDGET_ERRORS.INVALID_LAYOUT);
    }
    if (behavior.singleton) {
      const created = await this.layouts.insertSingleton(layout);
      if (!created) {
        const existing = await this.layouts.findByType(input.type);
        if (!existing) {
          throw new AppError(WIDGET_ERRORS.INVALID_STORED_WIDGET);
        }
        if (behavior.persistsOpenState && !existing.isOpen) {
          await this.layouts.setOpen(existing.id, true);
        } else if (!behavior.persistsOpenState && existing.isOpen) {
          await this.layouts.setOpen(existing.id, false);
        }
        return {
          widget: await this.hydrateOne({ ...existing, isOpen: true }),
          created: false,
        };
      }
    } else {
      await this.layouts.insert(layout);
    }
    if (!behavior.persistsOpenState) {
      await this.layouts.setOpen(layout.id, false);
    }
    return {
      widget: await this.hydrateOne({ ...layout, isOpen: true, file: null }),
      created: true,
    };
  }

  async openWidget(widgetId: string): Promise<DashboardWidget> {
    const widget = await this.requireWidget(widgetId);
    const behavior = WIDGET_BEHAVIOR[widget.type];
    if (behavior.persistsOpenState && widget.isOpen) {
      return this.hydrateOne(widget);
    }
    if (!widget.file && !behavior.persistsWithoutFile) {
      throw new AppError(WIDGET_ERRORS.WIDGET_NOT_FOUND);
    }
    if (!behavior.persistsOpenState && widget.isOpen) {
      await this.layouts.setOpen(widgetId, false);
    }
    await this.assertOpenCapacity();
    if (behavior.persistsOpenState) {
      await this.layouts.setOpen(widgetId, true);
    }
    return this.hydrateOne({ ...widget, isOpen: true });
  }

  async closeWidget(widgetId: string): Promise<void> {
    const widget = await this.requireWidget(widgetId);
    const behavior = WIDGET_BEHAVIOR[widget.type];
    if (!behavior.persistsOpenState) {
      if (widget.isOpen) {
        await this.layouts.setOpen(widgetId, false);
      }
      return;
    }
    if (!widget.isOpen) {
      throw new AppError(WIDGET_ERRORS.WIDGET_NOT_OPEN);
    }
    if (!widget.file && !behavior.persistsWithoutFile) {
      throw new AppError(WIDGET_ERRORS.UNSAVED_WIDGET_CLOSE_NOT_ALLOWED);
    }
    await this.layouts.setOpen(widgetId, false);
  }

  async discardWidget(widgetId: string): Promise<void> {
    const widget = await this.requireWidget(widgetId);
    if (WIDGET_BEHAVIOR[widget.type].persistsWithoutFile) {
      throw new AppError(WIDGET_ERRORS.BUILT_IN_WIDGET_DISCARD_NOT_ALLOWED);
    }
    if (widget.file) {
      throw new AppError(WIDGET_ERRORS.SAVED_WIDGET_DELETE_NOT_ALLOWED);
    }
    if (!(await this.layouts.deleteUnsaved(widgetId))) {
      throw new AppError(WIDGET_ERRORS.WIDGET_NOT_FOUND);
    }
  }

  private async hydrate(
    layouts: readonly StoredWidgetLayout[],
  ): Promise<DashboardWidget[]> {
    const now = this.clock.now();
    const { businessDate } = getKoreaDateContext(now);
    const memoIds = [...new Set(layouts.filter(layout => layout.type === WIDGET_TYPE.MEMO).map(layout => layout.id))];
    const checklistIds = [...new Set(layouts.filter(layout => layout.type === WIDGET_TYPE.DAILY_CHECKLIST).map(layout => layout.id))];
    const [memos, checklistItems, repeatSettings] = await Promise.all([
      memoIds.length ? this.memos.listByWidgetIds(memoIds) : [],
      checklistIds.length
        ? this.checklists.listActiveItemsByWidgetIds(checklistIds, businessDate)
        : [],
      checklistIds.length ? this.checklists.listRepeatSettings(checklistIds) : [],
    ]);
    const memoByWidgetId = new Map(
      memos.map((memo) => [memo.widgetId, memo] as const),
    );
    const repeatCycleByWidgetId = new Map(
      repeatSettings.map((setting) => [setting.widgetId, setting.repeatCycle] as const),
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

    const hydrators = {
      [WIDGET_TYPE.MEMO]: (layout: StoredWidgetLayout): DashboardWidget => {
        const memo = memoByWidgetId.get(layout.id);
        return {
          ...toPublicLayout(layout),
          type: WIDGET_TYPE.MEMO,
          file: layout.file,
          data: {
            markdown: memo?.markdown ?? EMPTY_MEMO_MARKDOWN,
            updatedAt:
              memo?.updatedAt === null || memo?.updatedAt === undefined
                ? null
                : new Date(memo.updatedAt).toISOString(),
          },
        };
      },
      [WIDGET_TYPE.DAILY_CHECKLIST]: (
        layout: StoredWidgetLayout,
      ): DashboardWidget => ({
        ...toPublicLayout(layout),
        type: WIDGET_TYPE.DAILY_CHECKLIST,
        file: layout.file,
        data: toChecklistData(
          now,
          repeatCycleByWidgetId.get(layout.id) ?? "daily",
          checklistItemsByWidgetId.get(layout.id) ?? [],
        ),
      }),
      [WIDGET_TYPE.STORAGE_STATUS]: (
        layout: StoredWidgetLayout,
      ): DashboardWidget => ({
        ...toPublicLayout(layout),
        type: WIDGET_TYPE.STORAGE_STATUS,
        file: null,
        data: null,
      }),
      [WIDGET_TYPE.IMAGE_UPLOAD_PROFILES]: (
        layout: StoredWidgetLayout,
      ): DashboardWidget => ({
        ...toPublicLayout(layout),
        type: WIDGET_TYPE.IMAGE_UPLOAD_PROFILES,
        file: null,
        data: null,
      }),
      [WIDGET_TYPE.ADMIN]: (
        layout: StoredWidgetLayout,
      ): DashboardWidget => ({
        ...toPublicLayout(layout),
        type: WIDGET_TYPE.ADMIN,
        file: null,
        data: null,
      }),
    } satisfies Record<
      WidgetType,
      (layout: StoredWidgetLayout) => DashboardWidget
    >;

    return layouts.map((layout) => hydrators[layout.type](layout));
  }

  private async hydrateOne(
    layout: StoredWidgetLayout,
  ): Promise<DashboardWidget> {
    const widget = (await this.hydrate([layout]))[0];
    if (!widget) {
      throw new AppError(WIDGET_ERRORS.INVALID_STORED_WIDGET);
    }
    return widget;
  }

  private async requireWidget(id: string): Promise<StoredWidgetLayout> {
    const widget = await this.layouts.findById(id);
    if (!widget) {
      throw new AppError(WIDGET_ERRORS.WIDGET_NOT_FOUND);
    }
    return widget;
  }

  private async assertOpenCapacity(): Promise<void> {
    if ((await this.layouts.countOpen()) >= MAX_OPEN_WIDGET_COUNT) {
      throw new AppError(WIDGET_ERRORS.TOO_MANY_WIDGETS);
    }
  }
}

function toPublicLayout(layout: StoredWidgetLayout): WidgetLayout {
  return {
    id: layout.id,
    type: layout.type,
    position: layout.position,
    size: layout.size,
    windowState: layout.windowState,
    restoreState: layout.restoreState,
    stackOrder: layout.stackOrder,
  };
}
