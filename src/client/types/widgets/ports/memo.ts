import type { MemoData } from "@/types/widgets/widget";

export interface MemoGateway {
  updateMemo(widgetId: string, markdown: string): Promise<MemoData>;
}
