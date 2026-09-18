import { FILESYSTEM_ROOT_ID, FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { FILE_STATUS } from "@/constants/filesystem/file";
import { FILESYSTEM_SEARCH_KIND } from "@/constants/filesystem/search";
import { FILESYSTEM_ENTRY_SELECT } from "@/infrastructure/filesystem/d1/filesystem-entry-select";
import { mapFilesystemEntryRow } from "@/infrastructure/filesystem/d1/filesystem-entry-row-mapper";
import type { FilesystemSearchQuery, FilesystemSearchRepository } from "@/types/filesystem/search/search";
import type { FilesystemEntryRow } from "@/types/platform/database";

interface SearchRow extends FilesystemEntryRow {
  parent_path: string;
}

export class D1FilesystemSearchRepository implements FilesystemSearchRepository {
  constructor(private readonly database: D1Database) {}

  async search(query: FilesystemSearchQuery, offset: number, limit: number) {
    const result = await this.database.prepare(
      `WITH RECURSIVE tree(id, path, parent_path, included) AS (
         SELECT id, name, '', 0 FROM filesystem_entries
         WHERE id IN (?1, ?2) AND trashed_at IS NULL
         UNION ALL
         SELECT child.id, tree.path || '/' || child.name, tree.path,
                CASE WHEN ?3 IS NULL OR tree.id = ?3 OR tree.included = 1 THEN 1 ELSE 0 END
         FROM filesystem_entries child JOIN tree ON child.parent_id = tree.id
         WHERE child.trashed_at IS NULL
       )
       SELECT e.*, tree.parent_path FROM (${FILESYSTEM_ENTRY_SELECT}) e
       JOIN tree ON tree.id = e.id
       WHERE tree.included = 1 AND instr(e.name_key, ?4) > 0
         AND (?5 = ?6 OR e.kind = ?5)
         AND (e.kind = ?7
           OR (e.kind = ?8 AND e.file_status = ?9)
           OR (e.kind = ?10 AND e.widget_type IS NOT NULL))
       ORDER BY e.name_key ASC, e.id ASC LIMIT ?11 OFFSET ?12`,
    ).bind(
      FILESYSTEM_ROOT_ID.DESKTOP, FILESYSTEM_ROOT_ID.DOCUMENTS,
      query.directoryId ?? null, query.q, query.kind, FILESYSTEM_SEARCH_KIND.ALL,
      FILESYSTEM_ENTRY_KIND.DIRECTORY, FILESYSTEM_ENTRY_KIND.FILE, FILE_STATUS.READY,
      FILESYSTEM_ENTRY_KIND.WIDGET, limit, offset,
    ).all<SearchRow>();
    return result.results.map((row) => ({
      entry: mapFilesystemEntryRow(row),
      parentPath: row.parent_path,
    }));
  }
}
