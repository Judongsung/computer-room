import {
  MAX_ACTIVE_CHECKLIST_ITEMS,
} from "../constants/checklist";
import { CHECKLIST_ERRORS } from "../constants/errors/checklist";
import { WIDGET_TYPE } from "../constants/widget";
import { normalizeChecklistLabel } from "../domain/checklist";
import { AppError } from "../domain/errors";
import { getKoreaDateContext } from "../domain/korea-date";
import type {
  ChecklistCheckInput,
  ChecklistItemRecord,
  ChecklistLabelInput,
} from "../types/checklist";
import type { ChecklistRepository } from "../types/checklist-repository";
import type { ChecklistUseCases } from "../types/checklist-service";
import type { Clock, IdGenerator } from "../types/runtime";
import type {
  ChecklistItem,
  ChecklistLogPage,
  DailyChecklistData,
} from "../types/widget";
import type { WidgetLayoutRepository } from "../types/widget-repository";
import { requireWidgetType } from "./widget-access";

export class ChecklistService implements ChecklistUseCases {
  constructor(
    private readonly layouts: WidgetLayoutRepository,
    private readonly checklists: ChecklistRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async getChecklist(widgetId: string): Promise<DailyChecklistData> {
    await this.requireChecklist(widgetId);
    const context = getKoreaDateContext(this.clock.now());
    const items = await this.checklists.listActiveItems(
      widgetId,
      context.businessDate,
    );

    return {
      businessDate: context.businessDate,
      nextResetAt: new Date(context.nextResetAt).toISOString(),
      items: items.map(toChecklistItem),
    };
  }

  async addItem(
    widgetId: string,
    input: ChecklistLabelInput,
  ): Promise<ChecklistItem> {
    await this.requireChecklist(widgetId);
    const label = normalizeChecklistLabel(input.label);
    const itemCount = await this.checklists.countActiveItems(widgetId);
    if (itemCount >= MAX_ACTIVE_CHECKLIST_ITEMS) {
      throw new AppError(CHECKLIST_ERRORS.TOO_MANY_ITEMS);
    }

    const item = {
      id: this.ids.generate(),
      widgetId,
      label,
      createdAt: this.clock.now(),
    };
    await this.checklists.insertItem(item);
    return { id: item.id, label, checked: false };
  }

  async updateItem(
    widgetId: string,
    itemId: string,
    input: ChecklistLabelInput,
  ): Promise<ChecklistItem> {
    await this.requireChecklist(widgetId);
    const label = normalizeChecklistLabel(input.label);
    const now = this.clock.now();
    const { businessDate } = getKoreaDateContext(now);
    const item = await this.requireItem(widgetId, itemId, businessDate);
    await this.checklists.updateItemLabel(widgetId, itemId, label, now);
    return { id: item.id, label, checked: item.checked };
  }

  async deleteItem(widgetId: string, itemId: string): Promise<void> {
    await this.requireChecklist(widgetId);
    const now = this.clock.now();
    const { businessDate } = getKoreaDateContext(now);
    await this.requireItem(widgetId, itemId, businessDate);
    await this.checklists.archiveItem(widgetId, itemId, now);
  }

  async setItemChecked(
    widgetId: string,
    itemId: string,
    input: ChecklistCheckInput,
  ): Promise<ChecklistItem> {
    if (typeof input.checked !== "boolean") {
      throw new AppError(CHECKLIST_ERRORS.INVALID_CHECK_STATE);
    }
    await this.requireChecklist(widgetId);
    const occurredAt = this.clock.now();
    const { businessDate } = getKoreaDateContext(occurredAt);
    const item = await this.requireItem(widgetId, itemId, businessDate);
    await this.checklists.setChecked({
      eventId: this.ids.generate(),
      widgetId,
      itemId,
      itemLabel: item.label,
      checked: input.checked,
      businessDate,
      occurredAt,
    });

    return { id: item.id, label: item.label, checked: input.checked };
  }

  async listLogs(
    widgetId: string,
    offset: number,
    limit: number,
  ): Promise<ChecklistLogPage> {
    await this.requireChecklist(widgetId);
    const events = await this.checklists.listEvents(widgetId, offset, limit + 1);
    const hasMore = events.length > limit;

    return {
      items: events.slice(0, limit).map((event) => ({
        id: event.id,
        itemId: event.itemId,
        itemLabel: event.itemLabel,
        action: event.action,
        businessDate: event.businessDate,
        occurredAt: new Date(event.occurredAt).toISOString(),
      })),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  private requireChecklist(widgetId: string): Promise<void> {
    return requireWidgetType(
      this.layouts,
      widgetId,
      WIDGET_TYPE.DAILY_CHECKLIST,
    );
  }

  private async requireItem(
    widgetId: string,
    itemId: string,
    businessDate: string,
  ): Promise<ChecklistItemRecord> {
    const item = await this.checklists.findActiveItem(
      widgetId,
      itemId,
      businessDate,
    );
    if (!item) {
      throw new AppError(CHECKLIST_ERRORS.ITEM_NOT_FOUND);
    }
    return item;
  }
}

function toChecklistItem(item: ChecklistItemRecord): ChecklistItem {
  return { id: item.id, label: item.label, checked: item.checked };
}
