import { D1ChecklistRepository } from "@/infrastructure/widgets/d1-checklist-repository";
import { GUEST_ACCESS_SETTINGS_SINGLETON_ID } from "@/constants/admin/guest-access";
import { FILE_STATUS } from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { directoryOrderClause } from "@/infrastructure/filesystem/d1/d1-directory-order";
import { mapFilesystemEntryRow } from "@/infrastructure/filesystem/d1/filesystem-entry-row-mapper";
import { FILESYSTEM_ENTRY_SELECT } from "@/infrastructure/filesystem/d1/filesystem-entry-select";
import type {
  FilesystemBreadcrumb,
  FilesystemDirectorySort,
  FilesystemEntryRecord,
} from "@/types/filesystem/filesystem";
import type { GuestPublicationRepository } from "@/types/guest/guest-repository";
import type {
  FilesystemEntryRow,
  MemoRow,
} from "@/types/platform/database";
import type { ChecklistItemRecord } from "@/types/widgets/checklist";
import type { MemoRecord } from "@/types/widgets/memo";

interface EnabledRow {
  readonly enabled: number;
}

interface BreadcrumbRow {
  readonly id: string;
  readonly name: string;
}

const VISIBLE_ENTRIES_CTE = `WITH RECURSIVE visible_entries(id) AS (
  SELECT publication.entry_id
  FROM guest_publications publication
  JOIN filesystem_entries published ON published.id = publication.entry_id
  WHERE published.trashed_at IS NULL
  UNION
  SELECT entry.parent_id
  FROM filesystem_entries entry
  JOIN visible_entries visible ON visible.id = entry.id
  WHERE entry.parent_id IS NOT NULL AND entry.trashed_at IS NULL
)`;

const ACTIVE_ROOT_MEMBERSHIP_CTE = `ancestors(id, parent_id) AS (
  SELECT id, parent_id FROM filesystem_entries WHERE id = ?1
  UNION ALL
  SELECT parent.id, parent.parent_id
  FROM filesystem_entries parent
  JOIN ancestors ON parent.id = ancestors.parent_id
)`;

export class D1GuestPublicationRepository
  implements GuestPublicationRepository
{
  constructor(private readonly database: D1Database) {}

  async isGuestAccessEnabled(): Promise<boolean> {
    const row = await this.database
      .prepare(
        "SELECT enabled FROM guest_access_settings WHERE singleton_id = ?1",
      )
      .bind(GUEST_ACCESS_SETTINGS_SINGLETON_ID)
      .first<EnabledRow>();
    return row?.enabled === 1;
  }

  async findVisibleDirectory(
    id: string,
  ): Promise<FilesystemEntryRecord | null> {
    const row = await this.database
      .prepare(
        `${VISIBLE_ENTRIES_CTE}, ${ACTIVE_ROOT_MEMBERSHIP_CTE}
         ${FILESYSTEM_ENTRY_SELECT}
         WHERE e.id = ?1
           AND e.kind = ?2
           AND e.trashed_at IS NULL
           AND (e.id IN (?3, ?4)
                OR EXISTS (SELECT 1 FROM visible_entries WHERE id = e.id))
           AND EXISTS (
             SELECT 1 FROM ancestors WHERE id IN (?3, ?4)
           )`,
      )
      .bind(
        id,
        FILESYSTEM_ENTRY_KIND.DIRECTORY,
        FILESYSTEM_ROOT_ID.DESKTOP,
        FILESYSTEM_ROOT_ID.DOCUMENTS,
      )
      .first<FilesystemEntryRow>();
    return row ? mapFilesystemEntryRow(row) : null;
  }

  async findPublishedEntry(
    id: string,
  ): Promise<FilesystemEntryRecord | null> {
    const row = await this.database
      .prepare(
        `WITH RECURSIVE ${ACTIVE_ROOT_MEMBERSHIP_CTE}
         ${FILESYSTEM_ENTRY_SELECT}
         JOIN guest_publications publication ON publication.entry_id = e.id
         WHERE e.id = ?1
           AND e.trashed_at IS NULL
           AND EXISTS (
             SELECT 1 FROM ancestors WHERE id IN (?2, ?3)
           )
           AND (e.kind = ?4
                OR (e.kind = ?5 AND f.status = ?6)
                OR (e.kind = ?7 AND w.type IN (?8, ?9)))`,
      )
      .bind(
        id,
        FILESYSTEM_ROOT_ID.DESKTOP,
        FILESYSTEM_ROOT_ID.DOCUMENTS,
        FILESYSTEM_ENTRY_KIND.DIRECTORY,
        FILESYSTEM_ENTRY_KIND.FILE,
        FILE_STATUS.READY,
        FILESYSTEM_ENTRY_KIND.WIDGET,
        WIDGET_TYPE.MEMO,
        WIDGET_TYPE.DAILY_CHECKLIST,
      )
      .first<FilesystemEntryRow>();
    return row ? mapFilesystemEntryRow(row) : null;
  }

  async listVisibleChildren(
    parentId: string,
    offset: number,
    limit: number,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemEntryRecord[]> {
    const result = await this.database
      .prepare(
        `${VISIBLE_ENTRIES_CTE}
         ${FILESYSTEM_ENTRY_SELECT}
         JOIN visible_entries visible ON visible.id = e.id
         WHERE e.parent_id = ?1
           AND e.trashed_at IS NULL
           AND (e.kind = ?2
                OR (e.kind = ?3 AND f.status = ?4)
                OR (e.kind = ?5 AND w.type IN (?6, ?7)))
         ORDER BY ${directoryOrderClause(sort)}
         LIMIT ?8 OFFSET ?9`,
      )
      .bind(
        parentId,
        FILESYSTEM_ENTRY_KIND.DIRECTORY,
        FILESYSTEM_ENTRY_KIND.FILE,
        FILE_STATUS.READY,
        FILESYSTEM_ENTRY_KIND.WIDGET,
        WIDGET_TYPE.MEMO,
        WIDGET_TYPE.DAILY_CHECKLIST,
        limit,
        offset,
      )
      .all<FilesystemEntryRow>();
    return result.results.map(mapFilesystemEntryRow);
  }

  async listBreadcrumbs(
    directoryId: string,
  ): Promise<FilesystemBreadcrumb[]> {
    const result = await this.database
      .prepare(
        `WITH RECURSIVE ancestors(id, parent_id, name, depth) AS (
           SELECT id, parent_id, name, 0
           FROM filesystem_entries WHERE id = ?1
           UNION ALL
           SELECT parent.id, parent.parent_id, parent.name, ancestors.depth + 1
           FROM filesystem_entries parent
           JOIN ancestors ON parent.id = ancestors.parent_id
         )
         SELECT id, name FROM ancestors
         WHERE id != ?2
         ORDER BY depth DESC`,
      )
      .bind(directoryId, FILESYSTEM_ROOT_ID.RECYCLE_BIN)
      .all<BreadcrumbRow>();
    return result.results.map(({ id, name }) => ({ id, name }));
  }

  async findMemo(widgetId: string): Promise<MemoRecord | null> {
    const row = await this.database
      .prepare(
        "SELECT widget_id, markdown, updated_at FROM memo_widgets WHERE widget_id = ?1",
      )
      .bind(widgetId)
      .first<MemoRow>();
    return row
      ? {
          widgetId: row.widget_id,
          markdown: row.markdown,
          updatedAt: row.updated_at,
        }
      : null;
  }

  async listChecklistItems(
    widgetId: string,
    businessDate: string,
  ): Promise<ChecklistItemRecord[]> {
    return new D1ChecklistRepository(this.database).listActiveItems(widgetId, businessDate);
  }
  async checklistRepeatCycle(widgetId: string) {
    return (await new D1ChecklistRepository(this.database).listRepeatSettings([widgetId])).find((row) => row.widgetId === widgetId)?.repeatCycle ?? "daily";
  }
}
