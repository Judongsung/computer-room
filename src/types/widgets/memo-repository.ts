import type { MemoRecord } from "@/types/widgets/memo";

export interface MemoRepository {
  listByWidgetIds(widgetIds: readonly string[]): Promise<MemoRecord[]>;
  upsert(record: MemoRecord): Promise<void>;
}
