import {
  GUEST_ACCESS_SETTINGS_SINGLETON_ID,
  GUEST_PUBLICATION_STATE,
} from "@/constants/admin/guest-access";
import type { GuestAccessRepository } from "@/types/admin/guest-access-repository";
import type {
  GuestAccessSettings,
  GuestPublicationState,
} from "@/types/admin/guest-access";

interface GuestAccessSettingsRow {
  readonly enabled: number;
}

interface GuestPublicationCountRow {
  readonly root_id: string;
  readonly total_count: number;
  readonly published_count: number;
}

export class D1GuestAccessRepository implements GuestAccessRepository {
  constructor(private readonly database: D1Database) {}

  async getSettings(): Promise<GuestAccessSettings> {
    const row = await this.database
      .prepare(
        `SELECT enabled FROM guest_access_settings WHERE singleton_id = ?1`,
      )
      .bind(GUEST_ACCESS_SETTINGS_SINGLETON_ID)
      .first<GuestAccessSettingsRow>();
    return { enabled: row?.enabled === 1 };
  }

  async saveSettings(enabled: boolean): Promise<GuestAccessSettings> {
    await this.database
      .prepare(
        `INSERT INTO guest_access_settings(singleton_id, enabled)
         VALUES (?1, ?2)
         ON CONFLICT(singleton_id) DO UPDATE SET enabled = excluded.enabled`,
      )
      .bind(GUEST_ACCESS_SETTINGS_SINGLETON_ID, enabled ? 1 : 0)
      .run();
    return { enabled };
  }

  async findPublicationStates(
    entryIds: readonly string[],
  ): Promise<ReadonlyMap<string, GuestPublicationState>> {
    if (entryIds.length === 0) return new Map();
    const result = await this.database
      .prepare(
        `WITH RECURSIVE requested(root_id) AS (
           SELECT DISTINCT CAST(value AS TEXT) FROM json_each(?1)
         ), subtree(root_id, id) AS (
           SELECT root_id, root_id FROM requested
           UNION ALL
           SELECT subtree.root_id, child.id
           FROM filesystem_entries child
           JOIN subtree ON child.parent_id = subtree.id
           WHERE child.trashed_at IS NULL
         )
         SELECT subtree.root_id,
                COUNT(*) AS total_count,
                SUM(CASE WHEN publication.entry_id IS NULL THEN 0 ELSE 1 END)
                  AS published_count
         FROM subtree
         LEFT JOIN guest_publications publication
           ON publication.entry_id = subtree.id
         GROUP BY subtree.root_id`,
      )
      .bind(JSON.stringify(entryIds))
      .all<GuestPublicationCountRow>();
    return new Map(
      result.results.map((row) => [
        row.root_id,
        publicationState(row.published_count, row.total_count),
      ] as const),
    );
  }

  async setEntryPublished(
    entryId: string,
    recursive: boolean,
    published: boolean,
    publishedAt: number,
  ): Promise<number> {
    const subtree = recursive
      ? `WITH RECURSIVE subtree(id) AS (
           SELECT id FROM filesystem_entries WHERE id = ?1
           UNION ALL
           SELECT child.id FROM filesystem_entries child
           JOIN subtree parent ON child.parent_id = parent.id
           WHERE child.trashed_at IS NULL
         )`
      : `WITH subtree(id) AS (
           SELECT id FROM filesystem_entries WHERE id = ?1
         )`;
    const statement = published
      ? this.database
          .prepare(
            `${subtree}
             INSERT OR IGNORE INTO guest_publications(entry_id, published_at)
             SELECT id, ?2 FROM subtree`,
          )
          .bind(entryId, publishedAt)
      : this.database
          .prepare(
            `${subtree}
             DELETE FROM guest_publications
             WHERE entry_id IN (SELECT id FROM subtree)`,
          )
          .bind(entryId);
    const result = await statement.run();
    return result.meta.changes;
  }
}

function publicationState(
  publishedCount: number,
  totalCount: number,
): GuestPublicationState {
  if (publishedCount === 0) return GUEST_PUBLICATION_STATE.PRIVATE;
  if (publishedCount === totalCount) return GUEST_PUBLICATION_STATE.PUBLIC;
  return GUEST_PUBLICATION_STATE.PARTIAL;
}
