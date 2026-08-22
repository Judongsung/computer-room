import type {
  FileObjectStorage,
  StoredObject,
  StoredObjectBody,
  StoredObjectRange,
} from "../src/types/storage";
import type { FilesystemRepository } from "../src/types/repository";
import type {
  FilesystemBreadcrumb,
  FilesystemEntryRecord,
  FilesystemFileObject,
  NewFilesystemDirectory,
  NewFilesystemFile,
  NewFilesystemWidget,
} from "../src/types/filesystem";
import { FILE_STATUS } from "../src/constants/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "../src/constants/filesystem";
import { WIDGET_TYPE } from "../src/constants/widget";
import type { StoredWidgetLayout, WidgetLayout } from "../src/types/widget";
import type { WidgetLayoutRepository } from "../src/types/widget-repository";
import type { MemoRepository } from "../src/types/memo-repository";
import type { MemoRecord } from "../src/types/memo";
import type { ChecklistRepository } from "../src/types/checklist-repository";
import type {
  ArchiveChecklistItemRecord,
  ChecklistEventRecord,
  ChecklistItemRecord,
  CreateChecklistItemRecord,
  SetChecklistStateRecord,
  UpdateChecklistItemRecord,
} from "../src/types/checklist";
import {
  CHECKLIST_EVENT_ACTION,
} from "../src/constants/checklist";
import type { Clock, IdGenerator } from "../src/types/runtime";
import type { MemoryObject } from "./types/fakes";

export class MemoryFileRepository implements FilesystemRepository {
  readonly records = new Map<string, FilesystemEntryRecord>();

  constructor() {
    this.seedRoot(FILESYSTEM_ROOT_ID.DESKTOP, FILESYSTEM_ROOT_NAME.DESKTOP);
    this.seedRoot(FILESYSTEM_ROOT_ID.DOCUMENTS, FILESYSTEM_ROOT_NAME.DOCUMENTS);
    this.seedRoot(FILESYSTEM_ROOT_ID.RECYCLE_BIN, FILESYSTEM_ROOT_NAME.RECYCLE_BIN);
  }

  async findEntry(id: string): Promise<FilesystemEntryRecord | null> {
    return cloneEntry(this.records.get(id) ?? null);
  }

  async listChildren(parentId: string, offset: number, limit: number): Promise<FilesystemEntryRecord[]> {
    return [...this.records.values()]
      .filter(
        (entry) =>
          entry.parentId === parentId &&
          entry.trashedAt === null &&
          (entry.kind !== FILESYSTEM_ENTRY_KIND.FILE ||
            entry.fileStatus === FILE_STATUS.READY),
      )
      .sort(
        (left, right) =>
          Number(left.kind === FILESYSTEM_ENTRY_KIND.FILE) -
            Number(right.kind === FILESYSTEM_ENTRY_KIND.FILE) ||
          left.nameKey.localeCompare(right.nameKey) ||
          left.id.localeCompare(right.id),
      )
      .slice(offset, offset + limit)
      .map((entry) => structuredClone(entry));
  }

  async listActiveFiles(offset: number, limit: number): Promise<FilesystemEntryRecord[]> {
    return [...this.records.values()]
      .filter(
        (entry) =>
          entry.kind === FILESYSTEM_ENTRY_KIND.FILE &&
          entry.fileStatus === FILE_STATUS.READY,
      )
      .filter((entry) => this.isInActiveRoot(entry.id))
      .sort(
        (left, right) =>
          right.createdAt - left.createdAt || right.id.localeCompare(left.id),
      )
      .slice(offset, offset + limit)
      .map((entry) => structuredClone(entry));
  }

  async listBreadcrumbs(directoryId: string): Promise<FilesystemBreadcrumb[]> {
    const result: FilesystemBreadcrumb[] = [];
    let current = this.records.get(directoryId);
    while (current) {
      if (current.id !== FILESYSTEM_ROOT_ID.RECYCLE_BIN) {
        result.unshift({ id: current.id, name: current.name });
      }
      current = current.parentId ? this.records.get(current.parentId) : undefined;
    }
    return result;
  }

  async listNameKeys(parentId: string, excludeId?: string): Promise<string[]> {
    return [...this.records.values()]
      .filter(
        (entry) =>
          entry.parentId === parentId &&
          entry.trashedAt === null &&
          entry.id !== excludeId,
      )
      .map((entry) => entry.nameKey);
  }

  async listDesktopEntryIds(): Promise<string[]> {
    return [...this.records.values()]
      .filter((entry) => entry.parentId === FILESYSTEM_ROOT_ID.DESKTOP)
      .sort(
        (left, right) =>
          (left.desktopOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.desktopOrder ?? Number.MAX_SAFE_INTEGER),
      )
      .map((entry) => entry.id);
  }

  async isWithinRoot(entryId: string, rootId: string): Promise<boolean> {
    let current = this.records.get(entryId);
    while (current) {
      if (current.id === rootId) return true;
      current = current.parentId ? this.records.get(current.parentId) : undefined;
    }
    return false;
  }

  async isDescendant(entryId: string, candidateId: string): Promise<boolean> {
    let current = this.records.get(candidateId);
    while (current?.parentId) {
      if (current.parentId === entryId) return true;
      current = this.records.get(current.parentId);
    }
    return false;
  }

  async insertDirectory(directory: NewFilesystemDirectory): Promise<void> {
    this.records.set(directory.id, {
      id: directory.id,
      parentId: directory.parentId,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name: directory.name,
      nameKey: directory.nameKey,
      fileId: null,
      widgetId: null,
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
      createdAt: directory.createdAt,
      updatedAt: directory.createdAt,
      objectKey: null,
      contentType: null,
      size: null,
      etag: null,
      fileStatus: null,
      widgetType: null,
      widgetOpen: null,
      desktopOrder: directory.desktopOrder ?? null,
    });
  }

  async insertPendingFile(file: NewFilesystemFile): Promise<void> {
    this.records.set(file.entry.id, {
      id: file.entry.id,
      parentId: file.entry.parentId,
      kind: FILESYSTEM_ENTRY_KIND.FILE,
      name: file.entry.name,
      nameKey: file.entry.nameKey,
      fileId: file.entry.id,
      widgetId: null,
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
      createdAt: file.entry.createdAt,
      updatedAt: file.entry.createdAt,
      objectKey: file.objectKey,
      contentType: file.contentType,
      size: file.size,
      etag: null,
      fileStatus: FILE_STATUS.PENDING,
      widgetType: null,
      widgetOpen: null,
      desktopOrder: file.entry.desktopOrder ?? null,
    });
  }

  async insertWidget(widget: NewFilesystemWidget): Promise<void> {
    this.records.set(widget.id, {
      id: widget.id,
      parentId: widget.parentId,
      kind: FILESYSTEM_ENTRY_KIND.WIDGET,
      name: widget.name,
      nameKey: widget.nameKey,
      fileId: null,
      widgetId: widget.widgetId,
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
      createdAt: widget.createdAt,
      updatedAt: widget.createdAt,
      objectKey: null,
      contentType: null,
      size: null,
      etag: null,
      fileStatus: null,
      widgetType: widget.widgetType,
      widgetOpen: true,
      desktopOrder: widget.desktopOrder ?? null,
    });
  }

  async findWidgetEntry(widgetId: string): Promise<FilesystemEntryRecord | null> {
    return cloneEntry(
      [...this.records.values()].find((entry) => entry.widgetId === widgetId) ??
        null,
    );
  }

  async markFileReady(id: string, size: number, etag: string): Promise<void> {
    const entry = this.requireEntry(id);
    this.records.set(id, { ...entry, size, etag, fileStatus: FILE_STATUS.READY });
  }

  async deleteFileMetadata(id: string): Promise<void> {
    this.records.delete(id);
  }

  async updateEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
    desktopEntryIds?: readonly string[],
  ): Promise<void> {
    const entry = this.requireEntry(id);
    this.records.set(id, {
      ...entry,
      parentId,
      name,
      nameKey,
      updatedAt,
      desktopOrder:
        parentId === FILESYSTEM_ROOT_ID.DESKTOP
          ? (desktopEntryIds?.indexOf(id) ?? entry.desktopOrder)
          : null,
    });
    if (desktopEntryIds) this.applyDesktopOrder(desktopEntryIds);
  }

  async moveToTrash(
    id: string,
    previousParentId: string,
    restorePath: string,
    trashedAt: number,
    desktopEntryIds?: readonly string[],
  ): Promise<string[]> {
    const entry = this.requireEntry(id);
    this.records.set(id, {
      ...entry,
      parentId: FILESYSTEM_ROOT_ID.RECYCLE_BIN,
      restoreParentId: previousParentId,
      restorePath,
      trashedAt,
      updatedAt: trashedAt,
      desktopOrder: null,
    });
    if (desktopEntryIds) this.applyDesktopOrder(desktopEntryIds);
    return this.subtree(id)
      .flatMap((candidate) => (candidate.widgetId ? [candidate.widgetId] : []));
  }

  async restoreEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
    desktopOrder?: number,
  ): Promise<void> {
    const entry = this.requireEntry(id);
    this.records.set(id, {
      ...entry,
      parentId,
      name,
      nameKey,
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
      updatedAt,
      desktopOrder: desktopOrder ?? null,
    });
  }

  async listTrash(offset: number, limit: number): Promise<FilesystemEntryRecord[]> {
    return [...this.records.values()]
      .filter(
        (entry) =>
          entry.parentId === FILESYSTEM_ROOT_ID.RECYCLE_BIN &&
          entry.trashedAt !== null,
      )
      .sort((left, right) => (right.trashedAt ?? 0) - (left.trashedAt ?? 0))
      .slice(offset, offset + limit)
      .map((entry) => structuredClone(entry));
  }

  async listTrashRootIds(): Promise<string[]> {
    return (await this.listTrash(0, Number.MAX_SAFE_INTEGER)).map((entry) => entry.id);
  }

  async listSubtreeFileObjects(rootId: string): Promise<FilesystemFileObject[]> {
    return this.subtree(rootId)
      .filter((entry) => entry.fileId && entry.objectKey)
      .map((entry) => ({ id: entry.fileId!, objectKey: entry.objectKey! }));
  }

  async purgeEntry(rootId: string): Promise<void> {
    for (const entry of this.subtree(rootId)) {
      this.records.delete(entry.id);
    }
  }

  private seedRoot(id: string, name: string): void {
    this.records.set(id, {
      id,
      parentId: null,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name,
      nameKey: name,
      fileId: null,
      widgetId: null,
      restoreParentId: null,
      restorePath: null,
      trashedAt: null,
      createdAt: 0,
      updatedAt: 0,
      objectKey: null,
      contentType: null,
      size: null,
      etag: null,
      fileStatus: null,
      widgetType: null,
      widgetOpen: null,
      desktopOrder: null,
    });
  }

  private requireEntry(id: string): FilesystemEntryRecord {
    const entry = this.records.get(id);
    if (!entry) throw new Error("Entry not found");
    return entry;
  }

  private isInActiveRoot(id: string): boolean {
    let current = this.records.get(id);
    while (current) {
      if (
        current.id === FILESYSTEM_ROOT_ID.DOCUMENTS ||
        current.id === FILESYSTEM_ROOT_ID.DESKTOP
      ) return true;
      current = current.parentId ? this.records.get(current.parentId) : undefined;
    }
    return false;
  }

  private subtree(rootId: string): FilesystemEntryRecord[] {
    const result: FilesystemEntryRecord[] = [];
    const pending = [rootId];
    while (pending.length > 0) {
      const id = pending.pop()!;
      const entry = this.records.get(id);
      if (!entry) continue;
      result.push(entry);
      for (const child of this.records.values()) {
        if (child.parentId === id) pending.push(child.id);
      }
    }
    return result;
  }

  private applyDesktopOrder(ids: readonly string[]): void {
    ids.forEach((id, desktopOrder) => {
      const entry = this.records.get(id);
      if (entry) this.records.set(id, { ...entry, desktopOrder });
    });
  }
}

export class MemoryObjectStorage implements FileObjectStorage {
  readonly objects = new Map<string, MemoryObject>();
  reportedSizeOffset = 0;
  failOnPut = false;
  failOnDelete = false;

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

  async get(
    key: string,
    range?: StoredObjectRange,
  ): Promise<StoredObjectBody | null> {
    const object = this.objects.get(key);
    if (!object) {
      return null;
    }

    const bytes = range
      ? object.bytes.slice(range.offset, range.offset + range.length)
      : object.bytes;
    return {
      body: new Blob([bytes]).stream(),
      size: object.bytes.byteLength,
      etag: object.etag,
      httpEtag: `"${object.etag}"`,
      contentType: object.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    if (this.failOnDelete) throw new Error("Storage delete failure");
    this.objects.delete(key);
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    if (this.failOnDelete) throw new Error("Storage delete failure");
    for (const key of keys) this.objects.delete(key);
  }
}

function cloneEntry(entry: FilesystemEntryRecord | null): FilesystemEntryRecord | null {
  return entry ? structuredClone(entry) : null;
}

export class MemoryWidgetLayoutRepository implements WidgetLayoutRepository {
  records: StoredWidgetLayout[] = [];

  async list(): Promise<StoredWidgetLayout[]> {
    return structuredClone(
      this.records
        .filter((widget) => widget.isOpen)
        .sort(
          (left, right) =>
            left.stackOrder - right.stackOrder ||
            left.id.localeCompare(right.id),
        ),
    );
  }

  async findById(id: string): Promise<StoredWidgetLayout | null> {
    const widget = this.records.find((record) => record.id === id);
    return widget ? structuredClone(widget) : null;
  }

  async synchronize(widgets: readonly WidgetLayout[]): Promise<void> {
    const updates = new Map(widgets.map((widget) => [widget.id, widget] as const));
    this.records = this.records.map((widget) => {
      const update = updates.get(widget.id);
      return update ? { ...structuredClone(update), isOpen: true, file: widget.file } : widget;
    });
  }

  async insert(widget: WidgetLayout): Promise<void> {
    this.records.push({ ...structuredClone(widget), isOpen: true, file: null });
  }

  async countOpen(): Promise<number> {
    return this.records.filter((widget) => widget.isOpen).length;
  }

  async setOpen(id: string, isOpen: boolean): Promise<void> {
    this.records = this.records.map((widget) =>
      widget.id === id ? { ...widget, isOpen } : widget,
    );
  }

  async deleteUnsaved(id: string): Promise<boolean> {
    const index = this.records.findIndex(
      (widget) => widget.id === id && widget.file === null,
    );
    if (index < 0) return false;
    this.records.splice(index, 1);
    return true;
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
    this.events.push({
      id: record.eventId,
      widgetId: record.widgetId,
      itemId: record.id,
      itemLabel: record.label,
      previousItemLabel: null,
      action: CHECKLIST_EVENT_ACTION.ADDED,
      businessDate: record.businessDate,
      occurredAt: record.createdAt,
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

  async updateItemLabel(record: UpdateChecklistItemRecord): Promise<void> {
    const index = this.items.findIndex(
      (item) =>
        item.widgetId === record.widgetId && item.id === record.itemId,
    );
    const item = this.items[index];
    if (item) {
      this.items[index] = { ...item, label: record.label };
      this.events.push({
        id: record.eventId,
        widgetId: record.widgetId,
        itemId: record.itemId,
        itemLabel: record.label,
        previousItemLabel: record.previousLabel,
        action: CHECKLIST_EVENT_ACTION.RENAMED,
        businessDate: record.businessDate,
        occurredAt: record.updatedAt,
      });
    }
  }

  async archiveItem(record: ArchiveChecklistItemRecord): Promise<void> {
    const index = this.items.findIndex(
      (item) =>
        item.widgetId === record.widgetId && item.id === record.itemId,
    );
    if (index >= 0) {
      this.items.splice(index, 1);
      this.events.push({
        id: record.eventId,
        widgetId: record.widgetId,
        itemId: record.itemId,
        itemLabel: record.itemLabel,
        previousItemLabel: null,
        action: CHECKLIST_EVENT_ACTION.DELETED,
        businessDate: record.businessDate,
        occurredAt: record.archivedAt,
      });
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
      previousItemLabel: null,
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
