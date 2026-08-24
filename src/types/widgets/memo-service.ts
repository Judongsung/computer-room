import type { MemoUpdateInput } from "@/types/widgets/memo";
import type { MemoData } from "@/types/widgets/widget";

export interface MemoUseCases {
  updateMemo(widgetId: string, input: MemoUpdateInput): Promise<MemoData>;
}
