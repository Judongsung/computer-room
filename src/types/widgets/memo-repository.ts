import type { MemoRecord, MemoVersionRecord, MemoVersionSummaryRecord } from "@/types/widgets/memo";

export interface MemoRepository {
  listByWidgetIds(widgetIds: readonly string[]): Promise<MemoRecord[]>;
  saveWithVersion(record: MemoRecord): Promise<MemoRecord>;
  listVersions(widgetId: string): Promise<MemoVersionSummaryRecord[]>;
  findVersion(widgetId: string, version: number): Promise<MemoVersionRecord | null>;
}
