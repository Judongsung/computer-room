import { FILE_STATUS } from "@/constants/filesystem/file";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { FILESYSTEM_ERRORS } from "@/constants/filesystem/errors/filesystem";
import { WIDGET_TYPE_VALUES } from "@/constants/widgets/widget";
import {
  FILESYSTEM_SORT_DIRECTION,
  FILESYSTEM_SORT_FIELD,
} from "@/constants/filesystem/sort";
import { AppError } from "@/domain/shared/errors";
import type { FilesystemEntryRow } from "@/types/platform/database";
import type {
  FilesystemBreadcrumb,
  FilesystemEntryRecord,
  FilesystemDirectorySort,
  FilesystemSortDirection,
  FilesystemSortField,
  FilesystemFileObject,
  NewFilesystemDirectory,
  NewExactFilesystemDirectory,
  NewFilesystemFile,
  NewFilesystemWidget,
  RootedFilesystemEntryRecord,
} from "@/types/filesystem/filesystem";
import type { FilesystemRepository } from "@/types/filesystem/repository";

const ENTRY_SELECT = `
  SELECT e.id, e.parent_id, e.kind, e.name, e.name_key, e.file_id,
         e.widget_id, e.restore_parent_id, e.restore_path, e.trashed_at,
         e.created_at, e.updated_at,
         f.object_key, f.content_type, f.size, f.etag, f.status AS file_status,
         w.type AS widget_type, w.is_open AS widget_open,
         desktop.sort_order AS desktop_order
  FROM filesystem_entries e
  LEFT JOIN files f ON f.id = e.file_id
  LEFT JOIN dashboard_widgets w ON w.id = e.widget_id
  LEFT JOIN desktop_entry_order desktop ON desktop.entry_id = e.id`;

const ROOTED_ENTRY_SELECT = `
  SELECT subtree.root_id,
         e.id, e.parent_id, e.kind, e.name, e.name_key, e.file_id,
         e.widget_id, e.restore_parent_id, e.restore_path, e.trashed_at,
         e.created_at, e.updated_at,
         f.object_key, f.content_type, f.size, f.etag, f.status AS file_status,
         w.type AS widget_type, w.is_open AS widget_open,
         desktop.sort_order AS desktop_order
  FROM subtree
  JOIN filesystem_entries e ON e.id = subtree.id
  LEFT JOIN files f ON f.id = e.file_id
  LEFT JOIN dashboard_widgets w ON w.id = e.widget_id
  LEFT JOIN desktop_entry_order desktop ON desktop.entry_id = e.id`;

interface BreadcrumbRow { id: string; name: string; depth: number }
interface NameKeyRow { name_key: string }
interface IdRow { id: string }
interface WidgetIdRow { widget_id: string }
interface ExistsRow { found: number }
interface FileObjectRow { id: string; object_key: string }
interface RootedFilesystemEntryRow extends FilesystemEntryRow { root_id: string }

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

export class D1FilesystemRepository implements FilesystemRepository {
  constructor(private readonly database: D1Database) {}

  async findEntry(id: string): Promise<FilesystemEntryRecord | null> {
    const row = await this.database
      .prepare(`${ENTRY_SELECT} WHERE e.id = ?1`)
      .bind(id)
      .first<FilesystemEntryRow>();
    return row ? mapEntryRow(row) : null;
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
         ${ENTRY_SELECT}
         WHERE e.id = ?1
           AND EXISTS (
             SELECT 1 FROM ancestors WHERE id IN (${rootPlaceholders})
           )`,
      )
      .bind(id, ...rootIds)
      .first<FilesystemEntryRow>();
    return row ? mapEntryRow(row) : null;
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
         ${ROOTED_ENTRY_SELECT}
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
      entry: mapEntryRow(row),
    }));
  }

  async findWidgetEntry(widgetId: string): Promise<FilesystemEntryRecord | null> {
    const row = await this.database
      .prepare(`${ENTRY_SELECT} WHERE e.widget_id = ?1`)
      .bind(widgetId)
      .first<FilesystemEntryRow>();
    return row ? mapEntryRow(row) : null;
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
        `${ENTRY_SELECT}
         WHERE e.parent_id = ?1 AND e.trashed_at IS NULL
           AND (e.kind = ?2 OR (e.kind = ?3 AND f.status = ?4)
                OR (e.kind = ?5 AND w.id IS NOT NULL))
         ORDER BY ${orderClause}
         LIMIT ?6 OFFSET ?7`,
      )
      .bind(parentId, FILESYSTEM_ENTRY_KIND.DIRECTORY,
        FILESYSTEM_ENTRY_KIND.FILE, FILE_STATUS.READY,
        FILESYSTEM_ENTRY_KIND.WIDGET, limit, offset)
      .all<FilesystemEntryRow>();
    return result.results.map(mapEntryRow);
  }

  async listBreadcrumbs(directoryId: string): Promise<FilesystemBreadcrumb[]> {
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
      ? this.database.prepare(
          `SELECT name_key FROM filesystem_entries
           WHERE parent_id = ?1 AND trashed_at IS NULL AND id != ?2`,
        ).bind(parentId, excludeId)
      : this.database.prepare(
          `SELECT name_key FROM filesystem_entries
           WHERE parent_id = ?1 AND trashed_at IS NULL`,
        ).bind(parentId);
    const result = await statement.all<NameKeyRow>();
    return result.results.map((row) => row.name_key);
  }

  async listDesktopEntryIds(): Promise<string[]> {
    const result = await this.database
      .prepare(
        `SELECT e.id FROM desktop_entry_order desktop
         JOIN filesystem_entries e ON e.id = desktop.entry_id
         WHERE e.parent_id = ?1 AND e.trashed_at IS NULL
         ORDER BY desktop.sort_order ASC, e.id ASC`,
      )
      .bind(FILESYSTEM_ROOT_ID.DESKTOP)
      .all<IdRow>();
    return result.results.map((row) => row.id);
  }

  async replaceDesktopEntryOrder(entryIds: readonly string[]): Promise<void> {
    await this.database.batch(this.desktopOrderReplacement(entryIds));
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

  async insertDirectory(directory: NewFilesystemDirectory): Promise<void> {
    const statements = [this.database.prepare(
      `INSERT INTO filesystem_entries (
         id, parent_id, kind, name, name_key, file_id, widget_id,
         restore_parent_id, restore_path, trashed_at, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, NULL, NULL, NULL, ?6, ?6)`,
    ).bind(directory.id, directory.parentId, FILESYSTEM_ENTRY_KIND.DIRECTORY,
      directory.name, directory.nameKey, directory.createdAt)];
    if (directory.desktopOrder !== undefined) {
      statements.push(this.desktopOrderInsert(directory.id, directory.desktopOrder));
    }
    await this.database.batch(statements);
  }

  async ensureDirectory(
    directory: NewExactFilesystemDirectory,
  ): Promise<FilesystemEntryRecord> {
    const statements = [
      this.database.prepare(
        `INSERT OR IGNORE INTO filesystem_entries (
           id, parent_id, kind, name, name_key, file_id, widget_id,
           restore_parent_id, restore_path, trashed_at, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, NULL, NULL, NULL, ?6, ?6)`,
      ).bind(
        directory.id,
        directory.parentId,
        FILESYSTEM_ENTRY_KIND.DIRECTORY,
        directory.name,
        directory.nameKey,
        directory.createdAt,
      ),
    ];

    if (directory.parentId === FILESYSTEM_ROOT_ID.DESKTOP) {
      statements.push(
        this.database.prepare(
          `INSERT OR IGNORE INTO desktop_entry_order (entry_id, sort_order)
           SELECT ?1, COALESCE((SELECT MAX(sort_order) + 1 FROM desktop_entry_order), 0)
           WHERE EXISTS (
             SELECT 1 FROM filesystem_entries
             WHERE id = ?1 AND parent_id = ?2 AND name_key = ?3
               AND trashed_at IS NULL
           )`,
        ).bind(directory.id, directory.parentId, directory.nameKey),
      );
    }

    statements.push(
      this.database.prepare(
        `${ENTRY_SELECT}
         WHERE e.parent_id = ?1 AND e.name_key = ?2 AND e.trashed_at IS NULL`,
      ).bind(directory.parentId, directory.nameKey),
    );
    const results = await this.database.batch<FilesystemEntryRow>(statements);
    const row = results.at(-1)?.results[0];
    if (!row) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
    return mapEntryRow(row);
  }

  async insertPendingFile(file: NewFilesystemFile): Promise<void> {
    const statements = [
      this.database.prepare(
        `INSERT INTO files (
           id, object_key, original_name, content_type, size, etag, status, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)`,
      ).bind(file.entry.id, file.objectKey, file.entry.name, file.contentType,
        file.size, FILE_STATUS.PENDING, file.entry.createdAt),
      this.database.prepare(
        `INSERT INTO filesystem_entries (
           id, parent_id, kind, name, name_key, file_id, widget_id,
           restore_parent_id, restore_path, trashed_at, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?1, NULL, NULL, NULL, NULL, ?6, ?6)`,
      ).bind(file.entry.id, file.entry.parentId, FILESYSTEM_ENTRY_KIND.FILE,
        file.entry.name, file.entry.nameKey, file.entry.createdAt),
    ];
    if (file.entry.desktopOrder !== undefined) {
      statements.push(this.desktopOrderInsert(file.entry.id, file.entry.desktopOrder));
    }
    await this.database.batch(statements);
  }

  async insertWidget(widget: NewFilesystemWidget): Promise<void> {
    const statements = [this.database.prepare(
      `INSERT INTO filesystem_entries (
         id, parent_id, kind, name, name_key, file_id, widget_id,
         restore_parent_id, restore_path, trashed_at, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, NULL, NULL, NULL, ?7, ?7)`,
    ).bind(widget.id, widget.parentId, FILESYSTEM_ENTRY_KIND.WIDGET,
      widget.name, widget.nameKey, widget.widgetId, widget.createdAt)];
    if (widget.desktopOrder !== undefined) {
      statements.push(this.desktopOrderInsert(widget.id, widget.desktopOrder));
    }
    await this.database.batch(statements);
  }

  async markFileReady(id: string, size: number, etag: string): Promise<void> {
    const result = await this.database.prepare(
      `UPDATE files SET size = ?2, etag = ?3, status = ?4
       WHERE id = ?1 AND status = ?5`,
    ).bind(id, size, etag, FILE_STATUS.READY, FILE_STATUS.PENDING).run();
    if (result.meta.changes !== 1) {
      throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
    }
  }

  async deleteFileMetadata(id: string): Promise<void> {
    await this.database.prepare("DELETE FROM files WHERE id = ?1").bind(id).run();
  }

  async updateEntry(id: string, parentId: string, name: string, nameKey: string,
    updatedAt: number, desktopEntryIds?: readonly string[]): Promise<void> {
    const statements = [this.database.prepare(
      `UPDATE filesystem_entries
       SET parent_id = ?2, name = ?3, name_key = ?4, updated_at = ?5
       WHERE id = ?1`,
    ).bind(id, parentId, name, nameKey, updatedAt)];
    if (desktopEntryIds) statements.push(...this.desktopOrderReplacement(desktopEntryIds));
    await this.database.batch(statements);
  }

  async moveToTrash(id: string, previousParentId: string, restorePath: string,
    trashedAt: number, desktopEntryIds?: readonly string[]): Promise<string[]> {
    const widgetIds = await this.listSubtreeWidgetIds(id);
    const statements = [this.database.prepare(
      `UPDATE filesystem_entries
       SET parent_id = ?2, restore_parent_id = ?3, restore_path = ?4,
           trashed_at = ?5, updated_at = ?5 WHERE id = ?1`,
    ).bind(id, FILESYSTEM_ROOT_ID.RECYCLE_BIN, previousParentId, restorePath, trashedAt)];
    statements.push(this.clearWallpaperWithinSubtree(id));
    if (widgetIds.length > 0) {
      const placeholders = widgetIds.map((_, index) => `?${index + 1}`).join(", ");
      statements.push(this.database.prepare(
        `UPDATE dashboard_widgets SET is_open = 0 WHERE id IN (${placeholders})`,
      ).bind(...widgetIds));
    }
    if (desktopEntryIds) statements.push(...this.desktopOrderReplacement(desktopEntryIds));
    await this.database.batch(statements);
    return widgetIds;
  }

  async restoreEntry(id: string, parentId: string, name: string, nameKey: string,
    updatedAt: number, desktopOrder?: number): Promise<void> {
    const statements = [this.database.prepare(
      `UPDATE filesystem_entries
       SET parent_id = ?2, name = ?3, name_key = ?4,
           restore_parent_id = NULL, restore_path = NULL,
           trashed_at = NULL, updated_at = ?5 WHERE id = ?1`,
    ).bind(id, parentId, name, nameKey, updatedAt)];
    if (desktopOrder !== undefined) statements.push(this.desktopOrderInsert(id, desktopOrder));
    await this.database.batch(statements);
  }

  async listTrash(offset: number, limit: number): Promise<FilesystemEntryRecord[]> {
    const result = await this.database.prepare(
      `${ENTRY_SELECT}
       WHERE e.parent_id = ?1 AND e.trashed_at IS NOT NULL
       ORDER BY e.trashed_at DESC, e.id DESC LIMIT ?2 OFFSET ?3`,
    ).bind(FILESYSTEM_ROOT_ID.RECYCLE_BIN, limit, offset).all<FilesystemEntryRow>();
    return result.results.map(mapEntryRow);
  }

  async listTrashRootIds(): Promise<string[]> {
    const result = await this.database.prepare(
      `SELECT id FROM filesystem_entries
       WHERE parent_id = ?1 AND trashed_at IS NOT NULL ORDER BY trashed_at ASC, id ASC`,
    ).bind(FILESYSTEM_ROOT_ID.RECYCLE_BIN).all<IdRow>();
    return result.results.map((row) => row.id);
  }

  async listSubtreeFileObjects(rootId: string): Promise<FilesystemFileObject[]> {
    const result = await this.database.prepare(
      `WITH RECURSIVE subtree(id, file_id) AS (
         SELECT id, file_id FROM filesystem_entries WHERE id = ?1
         UNION ALL
         SELECT child.id, child.file_id FROM filesystem_entries child
         JOIN subtree parent ON child.parent_id = parent.id
       ) SELECT f.id, f.object_key FROM subtree JOIN files f ON f.id = subtree.file_id
       ORDER BY f.id`,
    ).bind(rootId).all<FileObjectRow>();
    return result.results.map((row) => ({ id: row.id, objectKey: row.object_key }));
  }

  async purgeEntry(rootId: string): Promise<void> {
    await this.database.batch([
      this.database.prepare(
        `DELETE FROM files WHERE id IN (
           WITH RECURSIVE subtree(id, file_id) AS (
             SELECT id, file_id FROM filesystem_entries WHERE id = ?1
             UNION ALL
             SELECT child.id, child.file_id FROM filesystem_entries child
             JOIN subtree parent ON child.parent_id = parent.id
           ) SELECT file_id FROM subtree WHERE file_id IS NOT NULL
         )`,
      ).bind(rootId),
      this.database.prepare(
        `DELETE FROM dashboard_widgets WHERE id IN (
           WITH RECURSIVE subtree(id, widget_id) AS (
             SELECT id, widget_id FROM filesystem_entries WHERE id = ?1
             UNION ALL
             SELECT child.id, child.widget_id FROM filesystem_entries child
             JOIN subtree parent ON child.parent_id = parent.id
           ) SELECT widget_id FROM subtree WHERE widget_id IS NOT NULL
         )`,
      ).bind(rootId),
      this.database.prepare("DELETE FROM filesystem_entries WHERE id = ?1").bind(rootId),
    ]);
  }

  private async listSubtreeWidgetIds(rootId: string): Promise<string[]> {
    const result = await this.database.prepare(
      `WITH RECURSIVE subtree(id, widget_id) AS (
         SELECT id, widget_id FROM filesystem_entries WHERE id = ?1
         UNION ALL
         SELECT child.id, child.widget_id FROM filesystem_entries child
         JOIN subtree parent ON child.parent_id = parent.id
       ) SELECT widget_id FROM subtree WHERE widget_id IS NOT NULL ORDER BY widget_id`,
    ).bind(rootId).all<WidgetIdRow>();
    return result.results.map((row) => row.widget_id);
  }

  private clearWallpaperWithinSubtree(rootId: string): D1PreparedStatement {
    return this.database
      .prepare(
        `UPDATE mobile_preferences
         SET wallpaper_entry_id = NULL
         WHERE wallpaper_entry_id IN (
           WITH RECURSIVE subtree(id) AS (
             SELECT id FROM filesystem_entries WHERE id = ?1
             UNION ALL
             SELECT child.id FROM filesystem_entries child
             JOIN subtree parent ON child.parent_id = parent.id
           )
           SELECT id FROM subtree
         )`,
      )
      .bind(rootId);
  }

  private desktopOrderInsert(entryId: string, sortOrder: number): D1PreparedStatement {
    return this.database.prepare(
      "INSERT INTO desktop_entry_order (entry_id, sort_order) VALUES (?1, ?2)",
    ).bind(entryId, sortOrder);
  }

  private desktopOrderReplacement(entryIds: readonly string[]): D1PreparedStatement[] {
    return [this.database.prepare("DELETE FROM desktop_entry_order"),
      ...entryIds.map((entryId, sortOrder) => this.desktopOrderInsert(entryId, sortOrder))];
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

function mapEntryRow(row: FilesystemEntryRow): FilesystemEntryRecord {
  if (row.kind !== FILESYSTEM_ENTRY_KIND.DIRECTORY &&
      row.kind !== FILESYSTEM_ENTRY_KIND.FILE &&
      row.kind !== FILESYSTEM_ENTRY_KIND.WIDGET) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  if (row.file_status !== null && row.file_status !== FILE_STATUS.PENDING &&
      row.file_status !== FILE_STATUS.READY) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  const widgetType = WIDGET_TYPE_VALUES.find((candidate) => candidate === row.widget_type);
  if (row.kind === FILESYSTEM_ENTRY_KIND.WIDGET &&
      (!row.widget_id || !widgetType || !row.parent_id)) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  if (row.widget_open !== null && row.widget_open !== 0 && row.widget_open !== 1) {
    throw new AppError(FILESYSTEM_ERRORS.INVALID_STORED_ENTRY);
  }
  return {
    id: row.id, parentId: row.parent_id, kind: row.kind, name: row.name,
    nameKey: row.name_key, fileId: row.file_id, widgetId: row.widget_id,
    restoreParentId: row.restore_parent_id, restorePath: row.restore_path,
    trashedAt: row.trashed_at, createdAt: row.created_at, updatedAt: row.updated_at,
    objectKey: row.object_key, contentType: row.content_type, size: row.size,
    etag: row.etag, fileStatus: row.file_status, widgetType: widgetType ?? null,
    widgetOpen: row.widget_open === null ? null : row.widget_open === 1,
    desktopOrder: row.desktop_order,
  };
}
