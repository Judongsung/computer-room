import { checklistPeriod } from "@/domain/widgets/checklist-period";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type {
  NewWidgetFileDraft,
  WidgetFileDraftContentByType,
  WidgetFileType,
} from "@/types/widgets/widget-file";
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
    return buildWidgetFileContentStatements(
      this.database,
      draft.widget.id,
      draft.createdAt,
      draft.content,
    );
  }
}

type WidgetFileStatementBuilderMap = {
  readonly [T in WidgetFileType]: (
    database: D1Database,
    widgetId: string,
    createdAt: number,
    content: WidgetFileDraftContentByType<T>,
  ) => D1PreparedStatement[];
};

const WIDGET_FILE_STATEMENT_BUILDERS = {
  [WIDGET_TYPE.MEMO]: (
    database: D1Database,
    widgetId: string,
    createdAt: number,
    content: WidgetFileDraftContentByType<typeof WIDGET_TYPE.MEMO>,
  ) => [
    database
      .prepare(
        `INSERT INTO memo_widgets (widget_id, markdown, updated_at)
         VALUES (?1, ?2, ?3)`,
      )
      .bind(widgetId, content.markdown, createdAt),
  ],
  [WIDGET_TYPE.DAILY_CHECKLIST]: (
    database: D1Database,
    widgetId: string,
    createdAt: number,
    content: WidgetFileDraftContentByType<
      typeof WIDGET_TYPE.DAILY_CHECKLIST
    >,
  ) => {
    const items = JSON.stringify(content.items);
    return [
      database
        .prepare(
          `INSERT INTO checklist_items (
             id, widget_id, label, sort_order, created_at, updated_at
           )
           SELECT json_extract(value, '$.id'), ?1,
             json_extract(value, '$.label'), CAST(key AS INTEGER), ?2, ?2
           FROM json_each(?3)`,
        )
        .bind(widgetId, createdAt, items),
      database
        .prepare(
          `INSERT INTO checklist_period_states (
             item_id, settings_version, period_start, period_end, checked, checked_at
           )
           SELECT json_extract(value, '$.id'), 0, ?1, ?4, 1, ?2
           FROM json_each(?3)
           WHERE json_extract(value, '$.checked') = 1`,
        )
        .bind(content.businessDate, createdAt, items, checklistPeriod(createdAt, "daily").end),
    ];
  },
} satisfies WidgetFileStatementBuilderMap;

function buildWidgetFileContentStatements<T extends WidgetFileType>(
  database: D1Database,
  widgetId: string,
  createdAt: number,
  content: WidgetFileDraftContentByType<T>,
): D1PreparedStatement[] {
  const builder = WIDGET_FILE_STATEMENT_BUILDERS[
    content.type
  ] as unknown as (
    target: D1Database,
    id: string,
    timestamp: number,
    candidate: WidgetFileDraftContentByType<T>,
  ) => D1PreparedStatement[];
  return builder(database, widgetId, createdAt, content);
}
