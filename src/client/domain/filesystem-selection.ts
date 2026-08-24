export interface FilesystemSelectionModifiers {
  readonly toggle: boolean;
  readonly range: boolean;
}

export interface FilesystemSelectionChange {
  readonly selectedIds: ReadonlySet<string>;
  readonly anchorId: string;
}

export function changeFilesystemSelection(
  current: ReadonlySet<string>,
  orderedIds: readonly string[],
  id: string,
  anchorId: string | null,
  modifiers: FilesystemSelectionModifiers,
): FilesystemSelectionChange {
  if (modifiers.range && anchorId) {
    const anchorIndex = orderedIds.indexOf(anchorId);
    const targetIndex = orderedIds.indexOf(id);
    if (anchorIndex >= 0 && targetIndex >= 0) {
      const first = Math.min(anchorIndex, targetIndex);
      const last = Math.max(anchorIndex, targetIndex);
      const selectedIds = modifiers.toggle ? new Set(current) : new Set<string>();
      for (const candidate of orderedIds.slice(first, last + 1)) {
        selectedIds.add(candidate);
      }
      return { selectedIds, anchorId };
    }
  }

  if (modifiers.toggle) {
    const selectedIds = new Set(current);
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    return { selectedIds, anchorId: id };
  }

  return { selectedIds: new Set([id]), anchorId: id };
}

export function orderedSelectedIds(
  selectedIds: ReadonlySet<string>,
  orderedIds: readonly string[],
): string[] {
  return orderedIds.filter((id) => selectedIds.has(id));
}
