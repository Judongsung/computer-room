export const CHECKLIST_RESET_BUFFER_MILLISECONDS = 1_000;
export const MAX_BROWSER_TIMER_DELAY_MILLISECONDS = 2_147_483_647;

export const CHECKLIST_CLASS_NAME = {
  ROOT: "checklist-widget",
  EMPTY: "widget-empty",
  ITEMS: "checklist-items",
  ITEM_EDITOR: "checklist-item-editor",
  SECONDARY_BUTTON: "secondary-button",
  ITEM_LABEL: "checklist-item-label",
  ITEM_ACTIONS: "checklist-item-actions",
  ACTION: "widget-card__action",
  ADD_FORM: "checklist-add-form",
  ERROR: "widget-error",
} as const;

export const CHECKLIST_ELEMENT_ID_PREFIX = {
  ITEM_INPUT: "checklist-item-",
} as const;
