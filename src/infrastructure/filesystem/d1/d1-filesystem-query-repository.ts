import { FILE_STATUS } from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import {
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_FIELD,
} from "@/constants/filesystem/sort";
import type { FilesystemEntryRow } from "@/types/platform/database";
import type {
  FilesystemBreadcrumb,
  FilesystemDirectorySort,
  FilesystemEntryRecord,
  FilesystemSortDirection,
  FilesystemSortField,
  RootedFilesystemEntryRecord,
} from "@/types/filesystem/filesystem";
import type { FilesystemQueryRepository } from "@/types/filesystem/repository";
import {
  FILESYSTEM_ENTRY_SELECT,
  ROOTED_FILESYSTEM_ENTRY_SELECT,
} from "@/infrastructure/filesystem/d1/filesystem-entry-select";
import { mapFilesystemEntryRow } from "@/infrastructure/filesystem/d1/filesystem-entry-row-mapper";

interface BreadcrumbRow {
  id: string;
  name: string;
  depth: number;
}

interface NameKeyRow {
  name_key: string;
}

interface ExistsRow {
  found: number;
}

interface RootedFilesystemEntryRow extends FilesystemEntryRow {
  root_id: string;
}

const SORT_DIRECTION_SQL = {
  [FILESYSTEM_SORT_DIRECTION.ASCENDING]: "ASC",
  [FILESYSTEM_SORT_DIRECTION.DESCENDING]: "DESC",
} as const satisfies Record<FilesystemSortDirection, string>;

const SORT_EXPRESSION_SQL = {
  [FILESYSTEM_SORT_FIELD.NAME]: "e.name_key",
  [FILESYSTEM_SORT_FIELD.CREATED_AT]: "e.created_at",
  [FILESYSTEM_SORT_FIELD.UPDATED_AT]: "e.updated_at",
  [FILESYSTEM_SORT_FIELD.TYPE]:
    `CASE WHEN e.kind = '${FILESYSTEM_ENTRY_KIND.WIDGET}' ` +
    "THEN 'widget:' || COALESCE(w.type, '') " +
    "ELSE LOWER(TRIM(CASE " +
    "WHEN INSTR(f.content_type, ';') > 0 " +
    "THEN SUBSTR(f.content_type, 1, INSTR(f.content_type, ';') - 1) " +
    "ELSE COALESCE(f.content_type, '') END)) END",
  [FILESYSTEM_SORT_FIELD.SIZE]: "f.size",
} as const satisfies Record<FilesystemSortField, string>;

export class D1FilesystemQueryRepository
  implements FilesystemQueryRepository
{
  constructor(private readonly database: D1Database) {}

  async findEntry(id: string): Promise<FilesystemEntryRecord | null> {
    const row = await this.database
      .prepare(`${FILESYSTEM_ENTRY_SELECT} WHERE e.id = ?1`)
      .bind(id)
      .first<FilesystemEntryRow>();
    return row ? mapFilesystemEntryRow(row) : null;
  }

  async findEntryWithinRoots(
    id: string,
    rootIds: readonly string[],
  ): Promise<FilesystemEntryRecord | null> {
    if (rootIds.length === 0) return null;
    const rootPlaceholders = rootIds
      .map((_, index) => `?${index + 2}`)
      .join(", ");
    const row = await this.database
      .prepare(
        `WITH RECURSIVE ancestors(id, parent_id) AS (
           SELECT id, parent_id FROM filesystem_entries WHERE id = ?1
           UNION ALL
           SELECT parent.id, parent.parent_id FROM filesystem_entries parent
           JOIN ancestors ON parent.id = ancestors.parent_id
         )
         ${FILESYSTEM_ENTRY_SELECT}
         WHERE e.id = ?1
           AND EXISTS (
             SELECT 1 FROM ancestors WHERE id IN (${rootPlaceholders})
           )`,
      )
      .bind(id, ...rootIds)
      .first<FilesystemEntryRow>();
    return row ? mapFilesystemEntryRow(row) : null;
  }

  async findEntriesWithinRoots(
    ids: readonly string[],
    rootIds: readonly string[],
  ): Promise<FilesystemEntryRecord[]> {
    if (ids.length === 0 || rootIds.length === 0) return [];
    const rootPlaceholders = rootIds
      .map((_, index) => `?${index + 2}`)
      .join(", ");
    const result = await this.database
      .prepare(
        `WITH RECURSIVE requested(request_id) AS (
           SELECT CAST(value AS TEXT) FROM json_each(?1)
         ), ancestors(request_id, id, parent_id) AS (
           SELECT requested.request_id, entry.id, entry.parent_id
           FROM requested
           JOIN filesystem_entries entry ON entry.id = requested.request_id
           UNION ALL
           SELECT ancestors.request_id, parent.id, parent.parent_id
           FROM filesystem_entries parent
           JOIN ancestors ON parent.id = ancestors.parent_id
         ), active(request_id) AS (
           SELECT DISTINCT request_id FROM ancestors
           WHERE id IN (${rootPlaceholders})
         )
         ${FILESYSTEM_ENTRY_SELECT}
         JOIN active ON active.request_id = e.id
         ORDER BY e.id`,
      )
      .bind(JSON.stringify([...new Set(ids)]), ...rootIds)
      .all<FilesystemEntryRow>();
    return result.results.map(mapFilesystemEntryRow);
  }

  async listActiveSubtrees(
    rootIds: readonly string[],
  ): Promise<RootedFilesystemEntryRecord[]> {
    if (rootIds.length === 0) return [];
    const result = await this.database
      .prepare(
        `WITH RECURSIVE requested(root_id) AS (
           SELECT CAST(value AS TEXT) FROM json_each(?1)
         ), ancestors(root_id, id, parent_id) AS (
           SELECT requested.root_id, entry.id, entry.parent_id
           FROM requested
           JOIN filesystem_entries entry ON entry.id = requested.root_id
           UNION ALL
           SELECT ancestors.root_id, parent.id, parent.parent_id
           FROM filesystem_entries parent
           JOIN ancestors ON parent.id = ancestors.parent_id
         ), valid_roots(root_id) AS (
           SELECT DISTINCT root_id FROM ancestors WHERE id IN (?2, ?3)
         ), subtree(root_id, id) AS (
           SELECT root_id, root_id FROM valid_roots
           UNION ALL
           SELECT subtree.root_id, child.id
           FROM filesystem_entries child
           JOIN subtree ON child.parent_id = subtree.id
           WHERE child.trashed_at IS NULL
         )
         ${ROOTED_FILESYSTEM_ENTRY_SELECT}
         WHERE e.kind = ?4
            OR (e.kind = ?5 AND f.status = ?6)
            OR (e.kind = ?7 AND w.id IS NOT NULL)
         ORDER BY subtree.root_id, e.id`,
      )
      .bind(
        JSON.stringify([...new Set(rootIds)]),
        FILESYSTEM_ROOT_ID.DESKTOP,
        FILESYSTEM_ROOT_ID.DOCUMENTS,
        FILESYSTEM_ENTRY_KIND.DIRECTORY,
        FILESYSTEM_ENTRY_KIND.FILE,
        FILE_STATUS.READY,
        FILESYSTEM_ENTRY_KIND.WIDGET,
      )
      .all<RootedFilesystemEntryRow>();
    return result.results.map((row) => ({
      rootId: row.root_id,
      entry: mapFilesystemEntryRow(row),
    }));
  }

  async findWidgetEntry(
    widgetId: string,
  ): Promise<FilesystemEntryRecord | null> {
    const row = await this.database
      .prepare(`${FILESYSTEM_ENTRY_SELECT} WHERE e.widget_id = ?1`)
      .bind(widgetId)
      .first<FilesystemEntryRow>();
    return row ? mapFilesystemEntryRow(row) : null;
  }

  async listChildren(
    parentId: string,
    offset: number,
    limit: number,
    sort: FilesystemDirectorySort,
  ): Promise<FilesystemEntryRecord[]> {
    const orderClause = directoryOrderClause(sort);
    const result = await this.database
      .prepare(
        `${FILESYSTEM_ENTRY_SELECT}
         WHERE e.parent_id = ?1 AND e.trashed_at IS NULL
           AND (e.kind = ?2 OR (e.kind = ?3 AND f.status = ?4)
                OR (e.kind = ?5 AND w.id IS NOT NULL))
         ORDER BY ${orderClause}
         LIMIT ?6 OFFSET ?7`,
      )
      .bind(
        parentId,
        FILESYSTEM_ENTRY_KIND.DIRECTORY,
        FILESYSTEM_ENTRY_KIND.FILE,
        FILE_STATUS.READY,
        FILESYSTEM_ENTRY_KIND.WIDGET,
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
           SELECT id, parent_id, name, 0 FROM filesystem_entries WHERE id = ?1
           UNION ALL
           SELECT parent.id, parent.parent_id, parent.name, ancestors.depth + 1
           FROM filesystem_entries parent JOIN ancestors ON parent.id = ancestors.parent_id
         )
         SELECT id, name, depth FROM ancestors WHERE id != ?2 ORDER BY depth DESC`,
      )
      .bind(directoryId, FILESYSTEM_ROOT_ID.RECYCLE_BIN)
      .all<BreadcrumbRow>();
    return result.results.map(({ id, name }) => ({ id, name }));
  }

  async listNameKeys(parentId: string, excludeId?: string): Promise<string[]> {
    const statement = excludeId
      ? this.database
          .prepare(
            `SELECT name_key FROM filesystem_entries
             WHERE parent_id = ?1 AND trashed_at IS NULL AND id != ?2`,
          )
          .bind(parentId, excludeId)
      : this.database
          .prepare(
            `SELECT name_key FROM filesystem_entries
             WHERE parent_id = ?1 AND trashed_at IS NULL`,
          )
          .bind(parentId);
    const result = await statement.all<NameKeyRow>();
    return result.results.map((row) => row.name_key);
  }

  async isWithinRoot(entryId: string, rootId: string): Promise<boolean> {
    const row = await this.database
      .prepare(
        `WITH RECURSIVE ancestors(id, parent_id) AS (
           SELECT id, parent_id FROM filesystem_entries WHERE id = ?1
           UNION ALL
           SELECT parent.id, parent.parent_id FROM filesystem_entries parent
           JOIN ancestors ON parent.id = ancestors.parent_id
         ) SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = ?2) AS found`,
      )
      .bind(entryId, rootId)
      .first<ExistsRow>();
    return row?.found === 1;
  }

  async isDescendant(entryId: string, candidateId: string): Promise<boolean> {
    const row = await this.database
      .prepare(
        `WITH RECURSIVE descendants(id) AS (
           SELECT id FROM filesystem_entries WHERE parent_id = ?1
           UNION ALL
           SELECT child.id FROM filesystem_entries child
           JOIN descendants parent ON child.parent_id = parent.id
         ) SELECT EXISTS(SELECT 1 FROM descendants WHERE id = ?2) AS found`,
      )
      .bind(entryId, candidateId)
      .first<ExistsRow>();
    return row?.found === 1;
  }
}

function directoryOrderClause(sort: FilesystemDirectorySort): string {
  const direction = SORT_DIRECTION_SQL[sort.direction];
  const expression = SORT_EXPRESSION_SQL[sort.field];
  const sizePresenceOrder =
    sort.field === FILESYSTEM_SORT_FIELD.SIZE
      ? `CASE WHEN e.kind = '${FILESYSTEM_ENTRY_KIND.FILE}' THEN 0 ELSE 1 END ASC,`
      : "";
  return `CASE e.kind WHEN '${FILESYSTEM_ENTRY_KIND.DIRECTORY}' THEN 0 ELSE 1 END ASC,
          ${sizePresenceOrder}
          ${expression} ${direction}, e.name_key ASC, e.id ASC`;
}
