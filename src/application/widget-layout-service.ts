import { EMPTY_MEMO_MARKDOWN } from "../constants/memo";
import {
  FILESYSTEM_ACTIVE_ROOT_IDS,
  FILESYSTEM_ENTRY_KIND,
} from "../constants/filesystem";
import { FILESYSTEM_ERRORS } from "../constants/errors/filesystem";
import { WIDGET_ERRORS } from "../constants/errors/widget";
import {
  MAX_OPEN_WIDGET_COUNT,
  WIDGET_TYPE,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "../constants/widget";
import { AppError } from "../domain/errors";
import {
  availableFilesystemName,
  filesystemNameKey,
  normalizeFilesystemName,
} from "../domain/filesystem-name";
import { getKoreaDateContext } from "../domain/korea-date";
import { validateWidgetLayout } from "../domain/widget-layout-validation";
import type { ChecklistRepository } from "../types/checklist-repository";
import type {
  FilesystemWidgetEntry,
  SaveWidgetFileInput,
} from "../types/filesystem";
import type { MemoRepository } from "../types/memo-repository";
import type { FilesystemRepository } from "../types/repository";
import type { Clock, IdGenerator } from "../types/runtime";
import type {
  CreateWidgetInput,
  DashboardWidget,
  StoredWidgetLayout,
  WidgetLayout,
} from "../types/widget";
import type { WidgetLayoutRepository } from "../types/widget-repository";
import type { WidgetLayoutUseCases } from "../types/widget-service";
import { nextDesktopOrder } from "./desktop-placement";
import { toPublicEntry } from "./filesystem-service";

export class WidgetLayoutService implements WidgetLayoutUseCases {
  constructor(
    private readonly layouts: WidgetLayoutRepository,
    private readonly memos: MemoRepository,
    private readonly checklists: ChecklistRepository,
    private readonly filesystem: FilesystemRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async listWidgets(): Promise<DashboardWidget[]> {
    return this.hydrate(await this.layouts.list());
  }

  async replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<DashboardWidget[]> {
    const validatedWidgets = validateWidgetLayout(widgets);
    const existingWidgets = await Promise.all(
      validatedWidgets.map((widget) => this.layouts.findById(widget.id)),
    );
    const existingTypeById = new Map(
      existingWidgets.flatMap((widget) =>
        widget ? [[widget.id, widget.type] as const] : [],
      ),
    );
    for (const widget of validatedWidgets) {
      const existingType = existingTypeById.get(widget.id);
      if (existingType === undefined) {
        throw new AppError(WIDGET_ERRORS.WIDGET_NOT_FOUND);
      }
      if (existingType !== widget.type) {
        throw new AppError(WIDGET_ERRORS.WIDGET_TYPE_CHANGE_NOT_ALLOWED);
      }
    }

    await this.layouts.synchronize(validatedWidgets);
    return this.listWidgets();
  }

  async createWidget(input: CreateWidgetInput): Promise<DashboardWidget> {
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
    await this.layouts.insert(layout);
    return this.hydrateOne({ ...layout, isOpen: true, file: null });
  }

  async saveWidgetFile(
    widgetId: string,
    input: SaveWidgetFileInput,
  ): Promise<{ widget: DashboardWidget; entry: FilesystemWidgetEntry }> {
    const widget = await this.requireWidget(widgetId);
    if (widget.file) {
      throw new AppError(WIDGET_ERRORS.WIDGET_ALREADY_SAVED);
    }
    await this.requireActiveDirectory(input.parentId);
    const requestedName = normalizeFilesystemName(input.name);
    const occupied = new Set(
      await this.filesystem.listNameKeys(input.parentId),
    );
    const name = availableFilesystemName(requestedName, occupied);
    const createdAt = this.clock.now();
    const desktopOrder = await nextDesktopOrder(
      this.filesystem,
      input.parentId,
      input.desktopPlacement,
    );
    const entryId = this.ids.generate();
    await this.filesystem.insertWidget({
      id: entryId,
      widgetId,
      widgetType: widget.type,
      parentId: input.parentId,
      name,
      nameKey: filesystemNameKey(name),
      createdAt,
      ...(desktopOrder === undefined ? {} : { desktopOrder }),
    });
    const record = await this.filesystem.findEntry(entryId);
    const entry = record ? toPublicEntry(record) : null;
    if (!entry || entry.kind !== FILESYSTEM_ENTRY_KIND.WIDGET) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
    return {
      entry,
      widget: await this.hydrateOne({
        ...widget,
        file: { entryId, parentId: input.parentId, name },
      }),
    };
  }

  async openWidget(widgetId: string): Promise<DashboardWidget> {
    const widget = await this.requireWidget(widgetId);
    if (widget.isOpen) {
      return this.hydrateOne(widget);
    }
    if (!widget.file) {
      throw new AppError(WIDGET_ERRORS.WIDGET_NOT_FOUND);
    }
    await this.assertOpenCapacity();
    await this.layouts.setOpen(widgetId, true);
    return this.hydrateOne({ ...widget, isOpen: true });
  }

  async closeWidget(widgetId: string): Promise<void> {
    const widget = await this.requireWidget(widgetId);
    if (!widget.isOpen) {
      throw new AppError(WIDGET_ERRORS.WIDGET_NOT_OPEN);
    }
    if (!widget.file) {
      throw new AppError(WIDGET_ERRORS.UNSAVED_WIDGET_CLOSE_NOT_ALLOWED);
    }
    await this.layouts.setOpen(widgetId, false);
  }

  async discardWidget(widgetId: string): Promise<void> {
    const widget = await this.requireWidget(widgetId);
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
    const { businessDate, nextResetAt } = getKoreaDateContext(this.clock.now());
    const [memos, checklistItems] = await Promise.all([
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
      }
      return {
        ...toPublicLayout(layout),
        type: WIDGET_TYPE.DAILY_CHECKLIST,
        file: layout.file,
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

  private async requireActiveDirectory(id: string): Promise<void> {
    const entry = await this.filesystem.findEntry(id);
    if (!entry || entry.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_PARENT);
    }
    const matches = await Promise.all(
      FILESYSTEM_ACTIVE_ROOT_IDS.map((rootId) =>
        this.filesystem.isWithinRoot(id, rootId),
      ),
    );
    if (!matches.some(Boolean)) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_PARENT);
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

function toChecklistItem(item: {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
}) {
  return { id: item.id, label: item.label, checked: item.checked };
}
