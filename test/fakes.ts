import type {
  FileObjectStorage,
  StoredObject,
  StoredObjectBody,
} from "../src/types/storage";
import type { FileMetadata } from "../src/types/file";
import type { FileMetadataRepository } from "../src/types/repository";
import type { WidgetLayout } from "../src/types/widget";
import type { WidgetLayoutRepository } from "../src/types/widget-repository";
import type { MemoRepository } from "../src/types/memo-repository";
import type { MemoRecord } from "../src/types/memo";
import type { ChecklistRepository } from "../src/types/checklist-repository";
import type {
  ChecklistEventRecord,
  ChecklistItemRecord,
  CreateChecklistItemRecord,
  SetChecklistStateRecord,
} from "../src/types/checklist";
import {
  CHECKLIST_EVENT_ACTION,
} from "../src/constants/checklist";
import type { Clock, IdGenerator } from "../src/types/runtime";
import { cloneWidgetLayouts } from "../src/domain/widget-layout";
import type { MemoryObject } from "./types/fakes";

export class MemoryFileRepository implements FileMetadataRepository {
  readonly records = new Map<string, FileMetadata>();

  async insertPending(file: FileMetadata): Promise<void> {
    this.records.set(file.id, structuredClone(file));
  }

  async markReady(id: string, size: number, etag: string): Promise<void> {
    const file = this.records.get(id);
    if (!file) {
      throw new Error("File not found");
    }
    this.records.set(id, { ...file, size, etag, status: FILE_STATUS.READY });
  }

  async findReadyById(id: string): Promise<FileMetadata | null> {
    const file = this.records.get(id);
    return file?.status === FILE_STATUS.READY ? structuredClone(file) : null;
  }

  async listReady(offset: number, limit: number): Promise<FileMetadata[]> {
    return [...this.records.values()]
      .filter((file) => file.status === FILE_STATUS.READY)
      .sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id))
      .slice(offset, offset + limit)
      .map((file) => structuredClone(file));
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}

export class MemoryObjectStorage implements FileObjectStorage {
  readonly objects = new Map<string, MemoryObject>();
  reportedSizeOffset = 0;
  failOnPut = false;

  async put(
    key: string,
    body: ReadableStream<Uint8Array> | null,
    contentType: string,
  ): Promise<StoredObject> {
    if (this.failOnPut) {
      throw new Error("Storage failure");
    }

    const bytes = body
      ? new Uint8Array(await new Response(body).arrayBuffer())
      : new Uint8Array();
    const object = { bytes, contentType, etag: `etag-${key}` };
    this.objects.set(key, object);
    return {
      size: bytes.byteLength + this.reportedSizeOffset,
      etag: object.etag,
    };
  }

  async get(key: string): Promise<StoredObjectBody | null> {
    const object = this.objects.get(key);
    if (!object) {
      return null;
    }

    return {
      body: new Blob([object.bytes]).stream(),
      size: object.bytes.byteLength,
      etag: object.etag,
      httpEtag: `"${object.etag}"`,
      contentType: object.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

export class MemoryWidgetLayoutRepository implements WidgetLayoutRepository {
  records: WidgetLayout[] = [];

  async list(): Promise<WidgetLayout[]> {
    return cloneWidgetLayouts(this.records);
  }

  async findById(id: string): Promise<WidgetLayout | null> {
    const widget = this.records.find((record) => record.id === id);
    return widget ? cloneWidgetLayouts([widget])[0] ?? null : null;
  }

  async synchronize(widgets: readonly WidgetLayout[]): Promise<void> {
    this.records = cloneWidgetLayouts(widgets);
  }
}

export class MemoryMemoRepository implements MemoRepository {
  readonly records = new Map<string, MemoRecord>();

  async listAll(): Promise<MemoRecord[]> {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  async upsert(record: MemoRecord): Promise<void> {
    this.records.set(record.widgetId, { ...record });
  }
}

export class MemoryChecklistRepository implements ChecklistRepository {
  readonly items: ChecklistItemRecord[] = [];
  readonly events: ChecklistEventRecord[] = [];
  readonly states = new Map<string, boolean>();

  async listAllActiveItems(
    businessDate: string,
  ): Promise<ChecklistItemRecord[]> {
    return this.listItemsForDate(this.items, businessDate);
  }

  async listActiveItems(
    widgetId: string,
    businessDate: string,
  ): Promise<ChecklistItemRecord[]> {
    return this.listItemsForDate(
      this.items.filter((item) => item.widgetId === widgetId),
      businessDate,
    );
  }

  async countActiveItems(widgetId: string): Promise<number> {
    return this.items.filter((item) => item.widgetId === widgetId).length;
  }

  async insertItem(record: CreateChecklistItemRecord): Promise<void> {
    this.items.push({
      id: record.id,
      widgetId: record.widgetId,
      label: record.label,
      sortOrder: this.items.filter((item) => item.widgetId === record.widgetId)
        .length,
      checked: false,
    });
  }

  async findActiveItem(
    widgetId: string,
    itemId: string,
    businessDate: string,
  ): Promise<ChecklistItemRecord | null> {
    const item = this.items.find(
      (candidate) =>
        candidate.widgetId === widgetId && candidate.id === itemId,
    );
    return item
      ? {
          ...item,
          checked: this.states.get(stateKey(item.id, businessDate)) ?? false,
        }
      : null;
  }

  async updateItemLabel(
    widgetId: string,
    itemId: string,
    label: string,
  ): Promise<void> {
    const index = this.items.findIndex(
      (item) => item.widgetId === widgetId && item.id === itemId,
    );
    const item = this.items[index];
    if (item) {
      this.items[index] = { ...item, label };
    }
  }

  async archiveItem(widgetId: string, itemId: string): Promise<void> {
    const index = this.items.findIndex(
      (item) => item.widgetId === widgetId && item.id === itemId,
    );
    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }

  async setChecked(record: SetChecklistStateRecord): Promise<boolean> {
    const key = stateKey(record.itemId, record.businessDate);
    const previous = this.states.get(key) ?? false;
    if (previous === record.checked) {
      return false;
    }
    this.states.set(key, record.checked);
    this.events.push({
      id: record.eventId,
      widgetId: record.widgetId,
      itemId: record.itemId,
      itemLabel: record.itemLabel,
      action: record.checked
        ? CHECKLIST_EVENT_ACTION.CHECKED
        : CHECKLIST_EVENT_ACTION.UNCHECKED,
      businessDate: record.businessDate,
      occurredAt: record.occurredAt,
    });
    return true;
  }

  async listEvents(
    widgetId: string,
    offset: number,
    limit: number,
  ): Promise<ChecklistEventRecord[]> {
    return this.events
      .filter((event) => event.widgetId === widgetId)
      .sort(
        (left, right) =>
          right.occurredAt - left.occurredAt ||
          right.id.localeCompare(left.id),
      )
      .slice(offset, offset + limit)
      .map((event) => ({ ...event }));
  }

  private listItemsForDate(
    items: readonly ChecklistItemRecord[],
    businessDate: string,
  ): ChecklistItemRecord[] {
    return items
      .map((item) => ({
        ...item,
        checked: this.states.get(stateKey(item.id, businessDate)) ?? false,
      }))
      .sort(
        (left, right) =>
          left.widgetId.localeCompare(right.widgetId) ||
          left.sortOrder - right.sortOrder,
      );
  }
}

export class StaticClock implements Clock {
  constructor(public timestamp: number) {}

  now(): number {
    return this.timestamp;
  }
}

export class SequenceIdGenerator implements IdGenerator {
  private index = 0;

  constructor(private readonly ids: readonly string[]) {}

  generate(): string {
    const id = this.ids[this.index];
    if (!id) {
      throw new Error("No fake ID remains");
    }
    this.index += 1;
    return id;
  }
}

function stateKey(itemId: string, businessDate: string): string {
  return `${itemId}:${businessDate}`;
}

export function streamFromText(value: string): ReadableStream<Uint8Array> {
  return new Blob([value]).stream();
}
import { FILE_STATUS } from "../src/constants/file";
