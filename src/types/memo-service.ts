import type { MemoUpdateInput } from "./memo";
import type { MemoData } from "./widget";

export interface MemoUseCases {
  updateMemo(widgetId: string, input: MemoUpdateInput): Promise<MemoData>;
}
