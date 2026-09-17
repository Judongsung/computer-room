export interface FilesystemEntryRow {
  id: string;
  parent_id: string | null;
  kind: string;
  name: string;
  name_key: string;
  file_id: string | null;
  widget_id: string | null;
  restore_parent_id: string | null;
  restore_path: string | null;
  trashed_at: number | null;
  deletion_started_at: number | null;
  created_at: number;
  updated_at: number;
  object_key: string | null;
  content_type: string | null;
  size: number | null;
  etag: string | null;
  file_status: string | null;
  widget_type: string | null;
  widget_open: number | null;
  desktop_order: number | null;
}

export interface WidgetRow {
  id: string;
  type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  window_state: string;
  restore_state: string;
  stack_order: number;
  is_open: number;
  entry_id: string | null;
  entry_parent_id: string | null;
  entry_name: string | null;
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
  previous_item_label: string | null;
  action: string;
  business_date: string;
  occurred_at: number;
}

export interface CountRow {
  count: number;
}
