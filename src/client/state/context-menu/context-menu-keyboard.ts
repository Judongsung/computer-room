import type { KeyboardEvent } from "react";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";

export function focusXpContextMenuItem(
  menu: HTMLDivElement,
  index: number,
): void {
  enabledMenuItems(menu)[index]?.focus();
}

export function handleXpContextMenuKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  horizontal: {
    readonly previous?: () => void;
    readonly next?: () => void;
  } = {},
): void {
  if (event.key === KEYBOARD_KEY.ARROW_LEFT && horizontal.previous) {
    event.preventDefault();
    horizontal.previous();
    return;
  }
  if (event.key === KEYBOARD_KEY.ARROW_RIGHT && horizontal.next) {
    event.preventDefault();
    horizontal.next();
    return;
  }
  const items = enabledMenuItems(event.currentTarget);
  if (items.length === 0) return;
  const current =
    document.activeElement instanceof HTMLButtonElement
      ? items.indexOf(document.activeElement)
      : -1;
  let next: number | null = null;
  if (event.key === KEYBOARD_KEY.ARROW_DOWN) {
    next = (current + 1) % items.length;
  } else if (event.key === KEYBOARD_KEY.ARROW_UP) {
    next = (current - 1 + items.length) % items.length;
  } else if (event.key === KEYBOARD_KEY.HOME) {
    next = 0;
  } else if (event.key === KEYBOARD_KEY.END) {
    next = items.length - 1;
  } else if (
    event.key === KEYBOARD_KEY.ENTER ||
    event.key === KEYBOARD_KEY.SPACE
  ) {
    event.preventDefault();
    items[Math.max(0, current)]?.click();
    return;
  }
  if (next !== null) {
    event.preventDefault();
    items[next]?.focus();
  }
}

function enabledMenuItems(menu: HTMLDivElement): HTMLButtonElement[] {
  return Array.from(
    menu.querySelectorAll<HTMLButtonElement>(
      "[role='menuitem']:not(:disabled), [role='menuitemradio']:not(:disabled)",
    ),
  );
}
