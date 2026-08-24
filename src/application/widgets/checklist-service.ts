import {
  MAX_ACTIVE_CHECKLIST_ITEMS,
} from "@/constants/widgets/checklist";
import { CHECKLIST_ERRORS } from "@/constants/widgets/errors/checklist";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { normalizeChecklistLabel } from "@/domain/widgets/checklist";
import { AppError } from "@/domain/shared/errors";
import { getKoreaDateContext } from "@/domain/shared/korea-date";
import type {
  ChecklistCheckInput,
  ChecklistItemRecord,
  ChecklistLabelInput,
} from "@/types/widgets/checklist";
import type { ChecklistRepository } from "@/types/widgets/checklist-repository";
import type { ChecklistUseCases } from "@/types/widgets/checklist-service";
import type { Clock, IdGenerator } from "@/types/platform/runtime";
import type {
  ChecklistItem,
  ChecklistLogPage,
  DailyChecklistData,
} from "@/types/widgets/widget";
import type { WidgetLayoutRepository } from "@/types/widgets/widget-repository";
import { requireWidgetType } from "@/application/widgets/widget-access";

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
      eventId: this.ids.generate(),
      createdAt: this.clock.now(),
    };
    const { businessDate } = getKoreaDateContext(item.createdAt);
    await this.checklists.insertItem({ ...item, businessDate });
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
    if (item.label === label) {
      return { id: item.id, label, checked: item.checked };
    }
    await this.checklists.updateItemLabel({
      eventId: this.ids.generate(),
      widgetId,
      itemId,
      previousLabel: item.label,
      label,
      businessDate,
      updatedAt: now,
    });
    return { id: item.id, label, checked: item.checked };
  }

  async deleteItem(widgetId: string, itemId: string): Promise<void> {
    await this.requireChecklist(widgetId);
    const now = this.clock.now();
    const { businessDate } = getKoreaDateContext(now);
    const item = await this.requireItem(widgetId, itemId, businessDate);
    await this.checklists.archiveItem({
      eventId: this.ids.generate(),
      widgetId,
      itemId,
      itemLabel: item.label,
      businessDate,
      archivedAt: now,
    });
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
        previousItemLabel: event.previousItemLabel,
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
