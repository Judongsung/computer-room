// Reserve one of D1's 100 bindings for the checklist business date.
const WIDGET_IDS_PER_QUERY = 99;

export async function readWidgetIdChunks<T>(
  widgetIds: readonly string[],
  read: (ids: readonly string[]) => Promise<readonly T[]>,
): Promise<T[]> {
  const ids = [...new Set(widgetIds)];
  const records: T[] = [];
  for (let offset = 0; offset < ids.length; offset += WIDGET_IDS_PER_QUERY) {
    records.push(...await read(ids.slice(offset, offset + WIDGET_IDS_PER_QUERY)));
  }
  return records;
}
