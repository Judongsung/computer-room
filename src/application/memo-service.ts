import { WIDGET_TYPE } from "../constants/widget";
import { validateMemoMarkdown } from "../domain/memo";
import type { MemoUpdateInput } from "../types/memo";
import type { MemoRepository } from "../types/memo-repository";
import type { MemoUseCases } from "../types/memo-service";
import type { Clock } from "../types/runtime";
import type { MemoData } from "../types/widget";
import type { WidgetLayoutRepository } from "../types/widget-repository";
import { requireWidgetType } from "./widget-access";

export class MemoService implements MemoUseCases {
  constructor(
    private readonly layouts: WidgetLayoutRepository,
    private readonly memos: MemoRepository,
    private readonly clock: Clock,
  ) {}

  async updateMemo(
    widgetId: string,
    input: MemoUpdateInput,
  ): Promise<MemoData> {
    await requireWidgetType(this.layouts, widgetId, WIDGET_TYPE.MEMO);
    const markdown = validateMemoMarkdown(input.markdown);
    const updatedAt = this.clock.now();
    await this.memos.upsert({ widgetId, markdown, updatedAt });

    return { markdown, updatedAt: new Date(updatedAt).toISOString() };
  }
}
