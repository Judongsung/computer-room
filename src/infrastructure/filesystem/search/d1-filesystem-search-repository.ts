import { FILESYSTEM_ROOT_ID, FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { FILE_STATUS } from "@/constants/filesystem/file";
import { FILESYSTEM_SEARCH_KIND, FILESYSTEM_SEARCH_MODE, SEARCH_EXCERPT_CONTEXT, SEARCH_EXCERPT_LENGTH } from "@/constants/filesystem/search";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { filesystemNameKey } from "@/domain/filesystem/filesystem-name";
import { FILESYSTEM_ENTRY_SELECT } from "@/infrastructure/filesystem/d1/filesystem-entry-select";
import { mapFilesystemEntryRow } from "@/infrastructure/filesystem/d1/filesystem-entry-row-mapper";
import type { FilesystemSearchQuery, FilesystemSearchRepository } from "@/types/filesystem/search/search";
import type { FilesystemEntryRow } from "@/types/platform/database";

interface SearchRow extends FilesystemEntryRow {
  parent_path: string;
  excerpt: string | null;
}

const SCOPED_ENTRIES = `WITH RECURSIVE tree(id, path, parent_path, included) AS (
  SELECT id, name, '', 0 FROM filesystem_entries
  WHERE id IN (?1, ?2) AND trashed_at IS NULL
  UNION ALL
  SELECT child.id, tree.path || '/' || child.name, tree.path,
         CASE WHEN ?3 IS NULL OR tree.id = ?3 OR tree.included = 1 THEN 1 ELSE 0 END
  FROM filesystem_entries child JOIN tree ON child.parent_id = tree.id
  WHERE child.trashed_at IS NULL
), scoped AS (
  SELECT e.*, tree.parent_path FROM (${FILESYSTEM_ENTRY_SELECT}) e
  JOIN tree ON tree.id = e.id
  WHERE tree.included = 1 AND (?5 = ?6 OR e.kind = ?5)
    AND (e.kind = '${FILESYSTEM_ENTRY_KIND.SHORTCUT}' OR e.kind = ?7
      OR (e.kind = ?8 AND e.file_status = ?9)
      OR (e.kind = ?10 AND e.widget_type IS NOT NULL))
)`;

// Walk only the scope's ancestors for its full path, then visit its descendants.
// Reaching an active root preserves exclusion of trash and disconnected scopes.
const DIRECTORY_TREE = `WITH RECURSIVE ancestors(id, parent_id, path) AS (
  SELECT id, parent_id, name FROM filesystem_entries
  WHERE id = ?3 AND trashed_at IS NULL
  UNION ALL
  SELECT parent.id, parent.parent_id, parent.name || '/' || ancestors.path
  FROM filesystem_entries parent JOIN ancestors ON parent.id = ancestors.parent_id
  WHERE parent.trashed_at IS NULL
), tree(id, path, parent_path, included) AS (
  SELECT ?3, path, '', 0 FROM ancestors WHERE id IN (?1, ?2)
  UNION ALL
  SELECT child.id, tree.path || '/' || child.name, tree.path, 1
  FROM filesystem_entries child JOIN tree ON child.parent_id = tree.id
  WHERE child.trashed_at IS NULL
)`;

function scopedEntries(hasDirectoryScope: boolean): string {
  if (!hasDirectoryScope) return SCOPED_ENTRIES;
  // Keep a small scope from becoming a full entry-table scan at the join.
  const entries = `${FILESYSTEM_ENTRY_SELECT} WHERE e.id IN (SELECT id FROM tree WHERE included = 1)`;
  return `${DIRECTORY_TREE}, scoped AS (
  SELECT e.*, tree.parent_path FROM (${entries}) e
  JOIN tree ON tree.id = e.id
  WHERE tree.included = 1 AND (?5 = ?6 OR e.kind = ?5)
    AND (e.kind = '${FILESYSTEM_ENTRY_KIND.SHORTCUT}' OR e.kind = ?7
      OR (e.kind = ?8 AND e.file_status = ?9)
      OR (e.kind = ?10 AND e.widget_type IS NOT NULL))
)`;
}

const NAME_SEARCH = `
  SELECT scoped.*, NULL AS excerpt FROM scoped WHERE instr(name_key, ?4) > 0
  ORDER BY name_key ASC, id ASC LIMIT ?11 OFFSET ?12`;

// Keep source bodies inside SQL; only a bounded excerpt crosses the repository boundary.
const CONTENT_SEARCH = `, bodies AS MATERIALIZED (
  SELECT id, name_key, CASE WHEN kind = ?10 THEN CASE widget_type
    WHEN ?17 THEN (
      SELECT markdown FROM memo_widgets WHERE widget_id = scoped.widget_id
        AND instr(lower(markdown), lower(?13)) > 0
    )
    WHEN ?18 THEN (
      SELECT label FROM checklist_items WHERE widget_id = scoped.widget_id
        AND archived_at IS NULL AND instr(lower(label), lower(?13)) > 0
      ORDER BY sort_order ASC, id ASC LIMIT 1
    ) END END AS body FROM scoped
), matches AS (
  SELECT id, body, max(1, instr(lower(body), lower(?13)) - ?15) AS start
  FROM bodies WHERE body IS NOT NULL OR (?14 = '${FILESYSTEM_SEARCH_MODE.ALL}' AND instr(name_key, ?4) > 0)
  ORDER BY name_key ASC, id ASC LIMIT ?11 OFFSET ?12
)
SELECT scoped.*, CASE WHEN matches.body IS NULL THEN NULL ELSE
  CASE WHEN matches.start > 1 THEN '…' ELSE '' END ||
  substr(matches.body, matches.start, ?16) ||
  CASE WHEN length(matches.body) >= matches.start + ?16 THEN '…' ELSE '' END
  END AS excerpt
FROM matches JOIN scoped ON scoped.id = matches.id
ORDER BY scoped.name_key ASC, scoped.id ASC`;

export class D1FilesystemSearchRepository implements FilesystemSearchRepository {
  constructor(private readonly database: D1Database) {}

  async search(query: FilesystemSearchQuery, offset: number, limit: number) {
    const mode = query.mode ?? FILESYSTEM_SEARCH_MODE.NAME;
    const bindings = [
      FILESYSTEM_ROOT_ID.DESKTOP, FILESYSTEM_ROOT_ID.DOCUMENTS,
      query.directoryId ?? null, filesystemNameKey(query.q), query.kind, FILESYSTEM_SEARCH_KIND.ALL,
      FILESYSTEM_ENTRY_KIND.DIRECTORY, FILESYSTEM_ENTRY_KIND.FILE, FILE_STATUS.READY,
      FILESYSTEM_ENTRY_KIND.WIDGET, limit, offset,
    ];
    if (mode !== FILESYSTEM_SEARCH_MODE.NAME) {
      bindings.push(query.q, mode, SEARCH_EXCERPT_CONTEXT, SEARCH_EXCERPT_LENGTH, WIDGET_TYPE.MEMO, WIDGET_TYPE.DAILY_CHECKLIST);
    }
    const hasDirectoryScope = query.directoryId !== undefined;
    const sql = scopedEntries(hasDirectoryScope) + (mode === FILESYSTEM_SEARCH_MODE.NAME ? NAME_SEARCH : CONTENT_SEARCH);
    const result = await this.database.prepare(sql)
      .bind(...bindings).all<SearchRow>();
    return result.results.map((row) => ({
      entry: mapFilesystemEntryRow(row),
      parentPath: row.parent_path,
      contentMatch: row.excerpt === null ? null : { excerpt: row.excerpt },
    }));
  }
}
