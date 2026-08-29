export const FILESYSTEM_ENTRY_SELECT = `
  SELECT e.id, e.parent_id, e.kind, e.name, e.name_key, e.file_id,
         e.widget_id, e.restore_parent_id, e.restore_path, e.trashed_at,
         e.created_at, e.updated_at,
         f.object_key, f.content_type, f.size, f.etag, f.status AS file_status,
         w.type AS widget_type, w.is_open AS widget_open,
         desktop.sort_order AS desktop_order
  FROM filesystem_entries e
  LEFT JOIN files f ON f.id = e.file_id
  LEFT JOIN dashboard_widgets w ON w.id = e.widget_id
  LEFT JOIN desktop_entry_order desktop ON desktop.entry_id = e.id`;

export const ROOTED_FILESYSTEM_ENTRY_SELECT = `
  SELECT subtree.root_id,
         e.id, e.parent_id, e.kind, e.name, e.name_key, e.file_id,
         e.widget_id, e.restore_parent_id, e.restore_path, e.trashed_at,
         e.created_at, e.updated_at,
         f.object_key, f.content_type, f.size, f.etag, f.status AS file_status,
         w.type AS widget_type, w.is_open AS widget_open,
         desktop.sort_order AS desktop_order
  FROM subtree
  JOIN filesystem_entries e ON e.id = subtree.id
  LEFT JOIN files f ON f.id = e.file_id
  LEFT JOIN dashboard_widgets w ON w.id = e.widget_id
  LEFT JOIN desktop_entry_order desktop ON desktop.entry_id = e.id`;
