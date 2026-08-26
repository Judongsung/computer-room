import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { NewWidgetFileDraft } from "@/types/widgets/widget-file";
import type { WidgetFileDraftRepository } from "@/types/widgets/widget-file-repository";

export class D1WidgetFileDraftRepository
  implements WidgetFileDraftRepository
{
  constructor(private readonly database: D1Database) {}

  async insert(draft: NewWidgetFileDraft): Promise<void> {
    const statements = [
      this.database
        .prepare(
          `INSERT INTO dashboard_widgets (
             id, type, position_x, position_y, width, height,
             window_state, restore_state, stack_order, is_open
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)`,
        )
        .bind(
          draft.widget.id,
          draft.widget.type,
          draft.widget.position.x,
          draft.widget.position.y,
          draft.widget.size.width,
          draft.widget.size.height,
          draft.widget.windowState,
          draft.widget.restoreState,
          draft.widget.stackOrder,
        ),
      this.database
        .prepare(
          `INSERT INTO filesystem_entries (
             id, parent_id, kind, name, name_key, file_id, widget_id,
             restore_parent_id, restore_path, trashed_at, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, NULL, NULL, NULL, ?7, ?7)`,
        )
        .bind(
          draft.entry.id,
          draft.entry.parentId,
          FILESYSTEM_ENTRY_KIND.WIDGET,
          draft.entry.name,
          draft.entry.nameKey,
          draft.entry.widgetId,
          draft.createdAt,
        ),
    ];
    if (draft.entry.desktopOrder !== undefined) {
      statements.push(
        this.database
          .prepare(
            "INSERT INTO desktop_entry_order (entry_id, sort_order) VALUES (?1, ?2)",
          )
          .bind(draft.entry.id, draft.entry.desktopOrder),
      );
    }
    statements.push(...this.contentStatements(draft));
    await this.database.batch(statements);
  }

  private contentStatements(draft: NewWidgetFileDraft): D1PreparedStatement[] {
    if (draft.content.type === WIDGET_TYPE.MEMO) {
      return [
        this.database
          .prepare(
            `INSERT INTO memo_widgets (widget_id, markdown, updated_at)
             VALUES (?1, ?2, ?3)`,
          )
          .bind(draft.widget.id, draft.content.markdown, draft.createdAt),
      ];
    }
    const items = JSON.stringify(draft.content.items);
    return [
      this.database
        .prepare(
          `INSERT INTO checklist_items (
             id, widget_id, label, sort_order, created_at, updated_at
           )
           SELECT json_extract(value, '$.id'), ?1,
             json_extract(value, '$.label'), CAST(key AS INTEGER), ?2, ?2
           FROM json_each(?3)`,
        )
        .bind(draft.widget.id, draft.createdAt, items),
      this.database
        .prepare(
          `INSERT INTO checklist_daily_states (
             item_id, business_date, checked, updated_at
           )
           SELECT json_extract(value, '$.id'), ?1, 1, ?2
           FROM json_each(?3)
           WHERE json_extract(value, '$.checked') = 1`,
        )
        .bind(draft.content.businessDate, draft.createdAt, items),
    ];
  }
}
