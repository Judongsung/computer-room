import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { FilesystemEntryRow } from "@/types/platform/database";
import type {
  FilesystemEntryRecord,
  FilesystemFileObject,
} from "@/types/filesystem/filesystem";
import type { RecycleBinRepository } from "@/types/filesystem/repository";
import { desktopEntryOrderReplacement } from "@/infrastructure/filesystem/d1/desktop-entry-order-statements";
import { mapFilesystemEntryRow } from "@/infrastructure/filesystem/d1/filesystem-entry-row-mapper";
import { FILESYSTEM_ENTRY_SELECT } from "@/infrastructure/filesystem/d1/filesystem-entry-select";

interface IdRow {
  id: string;
}

interface WidgetIdRow {
  widget_id: string;
}

interface FileObjectRow {
  id: string;
  object_key: string;
}

export class D1RecycleBinRepository implements RecycleBinRepository {
  constructor(private readonly database: D1Database) {}

  async moveToTrash(
    id: string,
    previousParentId: string,
    restorePath: string,
    trashedAt: number,
    desktopEntryIds?: readonly string[],
  ): Promise<string[]> {
    const widgetIds = await this.listSubtreeWidgetIds(id);
    const statements = [
      this.database
        .prepare(
          `UPDATE filesystem_entries
           SET parent_id = ?2, restore_parent_id = ?3, restore_path = ?4,
               trashed_at = ?5, updated_at = ?5 WHERE id = ?1`,
        )
        .bind(
          id,
          FILESYSTEM_ROOT_ID.RECYCLE_BIN,
          previousParentId,
          restorePath,
          trashedAt,
        ),
      this.clearWallpaperWithinSubtree(id),
      this.clearGuestPublicationsWithinSubtree(id),
    ];
    if (widgetIds.length > 0) {
      const placeholders = widgetIds
        .map((_, index) => `?${index + 1}`)
        .join(", ");
      statements.push(
        this.database
          .prepare(
            `UPDATE dashboard_widgets SET is_open = 0 WHERE id IN (${placeholders})`,
          )
          .bind(...widgetIds),
      );
    }
    if (desktopEntryIds) {
      statements.push(
        ...desktopEntryOrderReplacement(this.database, desktopEntryIds),
      );
    }
    await this.database.batch(statements);
    return widgetIds;
  }

  async restoreEntry(
    id: string,
    parentId: string,
    name: string,
    nameKey: string,
    updatedAt: number,
    desktopOrder?: number,
  ): Promise<boolean> {
    const statements = [
      this.database
        .prepare(
          `UPDATE filesystem_entries
           SET parent_id = ?2, name = ?3, name_key = ?4,
               restore_parent_id = NULL, restore_path = NULL,
               trashed_at = NULL, updated_at = ?5 WHERE id = ?1 AND parent_id = ?6
               AND trashed_at IS NOT NULL AND deletion_started_at IS NULL`,
        )
        .bind(id, parentId, name, nameKey, updatedAt, FILESYSTEM_ROOT_ID.RECYCLE_BIN),
    ];
    if (desktopOrder !== undefined) {
      // This must immediately follow the guarded UPDATE in the same batch.
      statements.push(
        this.database
          .prepare(
            `INSERT INTO desktop_entry_order (entry_id, sort_order)
             SELECT ?1, ?2 WHERE changes() = 1`,
          )
          .bind(id, desktopOrder),
      );
    }
    const results = await this.database.batch(statements);
    return results[0]?.meta.changes === 1;
  }

  async startDeletion(id: string, startedAt: number): Promise<boolean> {
    const result = await this.database
      .prepare(
        `UPDATE filesystem_entries
         SET deletion_started_at = COALESCE(deletion_started_at, ?2)
         WHERE id = ?1 AND parent_id = ?3 AND trashed_at IS NOT NULL`,
      )
      .bind(id, startedAt, FILESYSTEM_ROOT_ID.RECYCLE_BIN)
      .run();
    return result.meta.changes === 1;
  }

  async listTrash(
    offset: number,
    limit: number,
  ): Promise<FilesystemEntryRecord[]> {
    const result = await this.database
      .prepare(
        `${FILESYSTEM_ENTRY_SELECT}
         WHERE e.parent_id = ?1 AND e.trashed_at IS NOT NULL
         ORDER BY e.trashed_at DESC, e.id DESC LIMIT ?2 OFFSET ?3`,
      )
      .bind(FILESYSTEM_ROOT_ID.RECYCLE_BIN, limit, offset)
      .all<FilesystemEntryRow>();
    return result.results.map(mapFilesystemEntryRow);
  }

  async listTrashRootIds(): Promise<string[]> {
    const result = await this.database
      .prepare(
        `SELECT id FROM filesystem_entries
         WHERE parent_id = ?1 AND trashed_at IS NOT NULL
         ORDER BY trashed_at ASC, id ASC`,
      )
      .bind(FILESYSTEM_ROOT_ID.RECYCLE_BIN)
      .all<IdRow>();
    return result.results.map((row) => row.id);
  }

  async listSubtreeFileObjects(
    rootId: string,
  ): Promise<FilesystemFileObject[]> {
    const result = await this.database
      .prepare(
        `WITH RECURSIVE subtree(id, file_id) AS (
           SELECT id, file_id FROM filesystem_entries WHERE id = ?1
           UNION ALL
           SELECT child.id, child.file_id FROM filesystem_entries child
           JOIN subtree parent ON child.parent_id = parent.id
         ) SELECT f.id, f.object_key FROM subtree JOIN files f ON f.id = subtree.file_id
         ORDER BY f.id`,
      )
      .bind(rootId)
      .all<FileObjectRow>();
    return result.results.map((row) => ({
      id: row.id,
      objectKey: row.object_key,
    }));
  }

  async purgeEntry(rootId: string): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `DELETE FROM files WHERE id IN (
             WITH RECURSIVE subtree(id, file_id) AS (
               SELECT id, file_id FROM filesystem_entries WHERE id = ?1
               UNION ALL
               SELECT child.id, child.file_id FROM filesystem_entries child
               JOIN subtree parent ON child.parent_id = parent.id
             ) SELECT file_id FROM subtree WHERE file_id IS NOT NULL
           )`,
        )
        .bind(rootId),
      this.database
        .prepare(
          `DELETE FROM dashboard_widgets WHERE id IN (
             WITH RECURSIVE subtree(id, widget_id) AS (
               SELECT id, widget_id FROM filesystem_entries WHERE id = ?1
               UNION ALL
               SELECT child.id, child.widget_id FROM filesystem_entries child
               JOIN subtree parent ON child.parent_id = parent.id
             ) SELECT widget_id FROM subtree WHERE widget_id IS NOT NULL
           )`,
        )
        .bind(rootId),
      this.database
        .prepare("DELETE FROM filesystem_entries WHERE id = ?1")
        .bind(rootId),
    ]);
  }

  private async listSubtreeWidgetIds(rootId: string): Promise<string[]> {
    const result = await this.database
      .prepare(
        `WITH RECURSIVE subtree(id, widget_id) AS (
           SELECT id, widget_id FROM filesystem_entries WHERE id = ?1
           UNION ALL
           SELECT child.id, child.widget_id FROM filesystem_entries child
           JOIN subtree parent ON child.parent_id = parent.id
         ) SELECT widget_id FROM subtree
           WHERE widget_id IS NOT NULL ORDER BY widget_id`,
      )
      .bind(rootId)
      .all<WidgetIdRow>();
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

  private clearGuestPublicationsWithinSubtree(
    rootId: string,
  ): D1PreparedStatement {
    return this.database
      .prepare(
        `DELETE FROM guest_publications
         WHERE entry_id IN (
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
}
