import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { DesktopEntryOrderRepository } from "@/types/filesystem/repository";
import { desktopEntryOrderReplacement } from "@/infrastructure/filesystem/d1/desktop-entry-order-statements";

interface IdRow {
  id: string;
}

export class D1DesktopEntryOrderRepository
  implements DesktopEntryOrderRepository
{
  constructor(private readonly database: D1Database) {}

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
    await this.database.batch(
      desktopEntryOrderReplacement(this.database, entryIds),
    );
  }
}
