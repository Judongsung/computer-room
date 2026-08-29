export function desktopEntryOrderInsert(
  database: D1Database,
  entryId: string,
  sortOrder: number,
): D1PreparedStatement {
  return database
    .prepare(
      "INSERT INTO desktop_entry_order (entry_id, sort_order) VALUES (?1, ?2)",
    )
    .bind(entryId, sortOrder);
}

export function desktopEntryOrderReplacement(
  database: D1Database,
  entryIds: readonly string[],
): D1PreparedStatement[] {
  return [
    database.prepare("DELETE FROM desktop_entry_order"),
    ...entryIds.map((entryId, sortOrder) =>
      desktopEntryOrderInsert(database, entryId, sortOrder),
    ),
  ];
}
