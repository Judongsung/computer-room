import type { MemoData } from "@/types/widgets/widget";
import type { MemoVersion, MemoVersionList } from "@/types/widgets/memo";

export interface MemoHistoryGateway {
  listMemoVersions(widgetId: string): Promise<MemoVersionList>;
  getMemoVersion(widgetId: string, version: number): Promise<MemoVersion>;
}

export interface MemoGateway extends MemoHistoryGateway {
  updateMemo(widgetId: string, markdown: string): Promise<MemoData>;
}
