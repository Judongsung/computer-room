import type { MemoUpdateInput, MemoVersion, MemoVersionList } from "@/types/widgets/memo";
import type { MemoData } from "@/types/widgets/widget";

export interface MemoUseCases {
  updateMemo(widgetId: string, input: MemoUpdateInput): Promise<MemoData>;
  listMemoVersions(widgetId: string): Promise<MemoVersionList>;
  getMemoVersion(widgetId: string, version: number): Promise<MemoVersion>;
}
