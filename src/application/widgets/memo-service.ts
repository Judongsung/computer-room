import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { validateMemoMarkdown } from "@/domain/widgets/memo";
import type { MemoUpdateInput } from "@/types/widgets/memo";
import type { MemoRepository } from "@/types/widgets/memo-repository";
import type { MemoUseCases } from "@/types/widgets/memo-service";
import type { Clock } from "@/types/platform/runtime";
import type { MemoData } from "@/types/widgets/widget";
import type { WidgetLayoutRepository } from "@/types/widgets/widget-repository";
import { requireWidgetType } from "@/application/widgets/widget-access";

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
