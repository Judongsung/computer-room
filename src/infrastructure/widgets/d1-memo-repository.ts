import { readWidgetIdChunks } from "@/infrastructure/widgets/d1-widget-id-query";
import { MAX_MEMO_VERSIONS } from "@/constants/widgets/memo";
import type { MemoRow } from "@/types/platform/database";
import type { MemoRecord, MemoVersionRecord, MemoVersionSummaryRecord } from "@/types/widgets/memo";
import type { MemoRepository } from "@/types/widgets/memo-repository";

export class D1MemoRepository implements MemoRepository {
  constructor(private readonly database: D1Database) {}

  async listByWidgetIds(widgetIds: readonly string[]): Promise<MemoRecord[]> {
    return readWidgetIdChunks(widgetIds, async ids => {
      const result = await this.database
        .prepare(`SELECT widget_id, markdown, updated_at FROM memo_widgets WHERE widget_id IN (${ids.map((_, index) => `?${index + 1}`).join(", ")})`)
        .bind(...ids)
        .all<MemoRow>();

      return result.results.map(mapMemoRow);
    });
  }

  async saveWithVersion(record: MemoRecord): Promise<MemoRecord> {
    const results = await this.database.batch<MemoRow>([
      this.database.prepare(
        `INSERT INTO memo_versions (widget_id, version, markdown, saved_at)
         SELECT ?1, COALESCE((SELECT MAX(version) FROM memo_versions WHERE widget_id = ?1), 0) + 1, ?2, ?3
         WHERE NOT EXISTS (SELECT 1 FROM memo_widgets WHERE widget_id = ?1 AND markdown = ?2)`,
      ).bind(record.widgetId, record.markdown, record.updatedAt),
      this.database.prepare(
        `INSERT INTO memo_widgets (widget_id, markdown, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(widget_id) DO UPDATE SET markdown = excluded.markdown, updated_at = excluded.updated_at
         WHERE memo_widgets.markdown <> excluded.markdown`,
      ).bind(record.widgetId, record.markdown, record.updatedAt),
      this.database.prepare(
        `DELETE FROM memo_versions WHERE widget_id = ?1
         AND version <= (SELECT MAX(version) - ?2 FROM memo_versions WHERE widget_id = ?1)`,
      ).bind(record.widgetId, MAX_MEMO_VERSIONS),
      this.database.prepare(
        "SELECT widget_id, markdown, updated_at FROM memo_widgets WHERE widget_id = ?1",
      ).bind(record.widgetId),
    ]);
    const stored = results.at(-1)?.results[0];
    if (!stored) throw new Error("Saved memo was not returned by D1 batch");
    return mapMemoRow(stored);
  }

  async listVersions(widgetId: string): Promise<MemoVersionSummaryRecord[]> {
    const result = await this.database.prepare(
      "SELECT version, saved_at FROM memo_versions WHERE widget_id = ?1 ORDER BY version DESC LIMIT ?2",
    ).bind(widgetId, MAX_MEMO_VERSIONS).all<MemoVersionSummaryRow>();
    return result.results.map(row => ({ version: row.version, savedAt: row.saved_at }));
  }

  async findVersion(widgetId: string, version: number): Promise<MemoVersionRecord | null> {
    const row = await this.database.prepare(
      "SELECT version, markdown, saved_at FROM memo_versions WHERE widget_id = ?1 AND version = ?2",
    ).bind(widgetId, version).first<MemoVersionRow>();
    return row ? { version: row.version, markdown: row.markdown, savedAt: row.saved_at } : null;
  }
}

interface MemoVersionSummaryRow {
  version: number;
  saved_at: number | null;
}

interface MemoVersionRow extends MemoVersionSummaryRow {
  markdown: string;
}

function mapMemoRow(row: MemoRow): MemoRecord {
  return {
    widgetId: row.widget_id,
    markdown: row.markdown,
    updatedAt: row.updated_at,
  };
}
