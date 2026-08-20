export interface FileRow {
  id: string;
  object_key: string;
  original_name: string;
  content_type: string;
  size: number;
  etag: string | null;
  status: string;
  created_at: number;
}

export interface WidgetRow {
  id: string;
  type: string;
  grid_column: number;
  grid_row: number;
  grid_columns: number;
  grid_rows: number;
}

export interface MemoRow {
  widget_id: string;
  markdown: string;
  updated_at: number | null;
}

export interface ChecklistItemRow {
  id: string;
  widget_id: string;
  label: string;
  sort_order: number;
  checked: number;
}

export interface ChecklistEventRow {
  id: string;
  widget_id: string;
  item_id: string;
  item_label: string;
  action: string;
  business_date: string;
  occurred_at: number;
}

export interface CountRow {
  count: number;
}
