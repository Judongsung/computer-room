import type { MemoRow } from "@/types/platform/database";
import type { MemoRecord } from "@/types/widgets/memo";
import type { MemoRepository } from "@/types/widgets/memo-repository";

export class D1MemoRepository implements MemoRepository {
  constructor(private readonly database: D1Database) {}

  async listAll(): Promise<MemoRecord[]> {
    const result = await this.database
      .prepare("SELECT widget_id, markdown, updated_at FROM memo_widgets")
      .all<MemoRow>();

    return result.results.map(mapMemoRow);
  }

  async upsert(record: MemoRecord): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO memo_widgets (widget_id, markdown, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(widget_id) DO UPDATE SET
           markdown = excluded.markdown,
           updated_at = excluded.updated_at`,
      )
      .bind(record.widgetId, record.markdown, record.updatedAt)
      .run();
  }
}

function mapMemoRow(row: MemoRow): MemoRecord {
  return {
    widgetId: row.widget_id,
    markdown: row.markdown,
    updatedAt: row.updated_at,
  };
}
