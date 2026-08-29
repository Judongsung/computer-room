import type { ChecklistItem } from "@/types/widgets/widget";

export function replaceChecklistItem(
  items: readonly ChecklistItem[],
  replacement: ChecklistItem,
): readonly ChecklistItem[] {
  return items.map((item) =>
    item.id === replacement.id ? replacement : item,
  );
}

export function removeChecklistItem(
  items: readonly ChecklistItem[],
  itemId: string,
): readonly ChecklistItem[] {
  return items.filter((item) => item.id !== itemId);
}
