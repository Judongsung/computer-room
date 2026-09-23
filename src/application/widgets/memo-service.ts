import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { MEMO_ERRORS } from "@/constants/widgets/errors/memo";
import { AppError } from "@/domain/shared/errors";
import { validateMemoMarkdown } from "@/domain/widgets/memo";
import type { MemoUpdateInput, MemoVersion, MemoVersionList } from "@/types/widgets/memo";
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
    const stored = await this.memos.saveWithVersion({ widgetId, markdown, updatedAt });

    return { markdown: stored.markdown, updatedAt: stored.updatedAt === null ? null : new Date(stored.updatedAt).toISOString() };
  }

  async listMemoVersions(widgetId: string): Promise<MemoVersionList> {
    await requireWidgetType(this.layouts, widgetId, WIDGET_TYPE.MEMO);
    const records = await this.memos.listVersions(widgetId);
    return { items: records.map(({ version, savedAt }) => ({
      version,
      savedAt: savedAt === null ? null : new Date(savedAt).toISOString(),
    })) };
  }

  async getMemoVersion(widgetId: string, version: number): Promise<MemoVersion> {
    await requireWidgetType(this.layouts, widgetId, WIDGET_TYPE.MEMO);
    if (!Number.isSafeInteger(version) || version <= 0) throw new AppError(MEMO_ERRORS.INVALID_VERSION);
    const record = await this.memos.findVersion(widgetId, version);
    if (!record) throw new AppError(MEMO_ERRORS.VERSION_NOT_FOUND);
    return {
      version: record.version,
      markdown: record.markdown,
      savedAt: record.savedAt === null ? null : new Date(record.savedAt).toISOString(),
    };
  }
}
