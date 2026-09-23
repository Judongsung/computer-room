export interface MemoRecord {
  readonly widgetId: string;
  readonly markdown: string;
  readonly updatedAt: number | null;
}

export interface MemoUpdateInput {
  readonly markdown: string;
}

export interface MemoVersionSummary {
  readonly version: number;
  readonly savedAt: string | null;
}

export interface MemoVersion extends MemoVersionSummary {
  readonly markdown: string;
}

export interface MemoVersionList {
  readonly items: MemoVersionSummary[];
}

export interface MemoVersionSummaryRecord {
  readonly version: number;
  readonly savedAt: number | null;
}

export interface MemoVersionRecord extends MemoVersionSummaryRecord {
  readonly markdown: string;
}
