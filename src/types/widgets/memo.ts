export interface MemoRecord {
  readonly widgetId: string;
  readonly markdown: string;
  readonly updatedAt: number | null;
}

export interface MemoUpdateInput {
  readonly markdown: string;
}
