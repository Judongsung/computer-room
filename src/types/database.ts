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
