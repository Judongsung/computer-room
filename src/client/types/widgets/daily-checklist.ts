import type { ChecklistItem } from "@/types/widgets/widget";

export interface DailyChecklistController {
  readonly isEditingItems: boolean;
  readonly newLabel: string;
  readonly editingItemId: string | null;
  readonly editingLabel: string;
  readonly isMutating: boolean;
  readonly showLogs: boolean;
  readonly error: string | null;
  readonly canAddItem: boolean;
  readonly setNewLabel: (label: string) => void;
  readonly setEditingLabel: (label: string) => void;
  readonly toggleEditing: () => void;
  readonly beginEditingItem: (item: ChecklistItem) => void;
  readonly cancelEditingItem: () => void;
  readonly addItem: () => Promise<void>;
  readonly updateItem: (item: ChecklistItem) => Promise<void>;
  readonly deleteItem: (item: ChecklistItem) => Promise<void>;
  readonly toggleItem: (
    item: ChecklistItem,
    checked: boolean,
  ) => Promise<void>;
  readonly openLogs: () => void;
  readonly closeLogs: () => void;
}
