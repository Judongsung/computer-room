import { useId, useRef, type KeyboardEvent } from "react";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { XP_EXPLORER_HEADER_CLASS_NAME } from "@client/constants/filesystem/explorer-header";
import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import type { XpExplorerMenu } from "@client/types/filesystem/explorer-header";

export function XpExplorerMenuBar({
  menus,
}: {
  readonly menus: readonly XpExplorerMenu[];
}) {
  const contextMenu = useXpContextMenu();
  const menuBarRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pointerSwitchedSourceRef = useRef<string | null>(null);
  const menuBarId = useId();
  const sourcePrefix = `xp-explorer-menu-${menuBarId}-`;
  const ownMenuOpen = contextMenu.activeSourceId?.startsWith(sourcePrefix) ?? false;

  function sourceId(index: number): string {
    return `${sourcePrefix}${menus[index]?.id ?? index}`;
  }

  function openMenu(index: number): void {
    const menu = menus[index];
    const anchor = buttonRefs.current[index];
    if (!menu || !anchor) return;
    contextMenu.openAnchored({
      sourceId: sourceId(index),
      anchor,
      ...(menuBarRef.current ? { boundary: menuBarRef.current } : {}),
      items: menu.items,
      label: menu.label,
      onNavigatePrevious: () => openMenu(wrapIndex(index - 1, menus.length)),
      onNavigateNext: () => openMenu(wrapIndex(index + 1, menus.length)),
    });
  }

  function moveTriggerFocus(index: number): void {
    buttonRefs.current[wrapIndex(index, menus.length)]?.focus();
  }

  function handleTriggerKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void {
    if (event.key === KEYBOARD_KEY.ARROW_LEFT) {
      event.preventDefault();
      moveTriggerFocus(index - 1);
    } else if (event.key === KEYBOARD_KEY.ARROW_RIGHT) {
      event.preventDefault();
      moveTriggerFocus(index + 1);
    } else if (event.key === KEYBOARD_KEY.HOME) {
      event.preventDefault();
      moveTriggerFocus(0);
    } else if (event.key === KEYBOARD_KEY.END) {
      event.preventDefault();
      moveTriggerFocus(menus.length - 1);
    } else if (
      event.key === KEYBOARD_KEY.ARROW_DOWN ||
      event.key === KEYBOARD_KEY.ENTER ||
      event.key === KEYBOARD_KEY.SPACE
    ) {
      event.preventDefault();
      openMenu(index);
    } else if (event.key === KEYBOARD_KEY.ESCAPE) {
      contextMenu.close();
    }
  }

  return (
    <div
      ref={menuBarRef}
      className={XP_EXPLORER_HEADER_CLASS_NAME.MENU_BAR}
      role="menubar"
      aria-label={XP_EXPLORER_HEADER_COPY.MENU_BAR}
    >
      {menus.map((menu, index) => {
        const active = contextMenu.activeSourceId === sourceId(index);
        return (
          <button
            key={menu.id}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            type="button"
            className={XP_EXPLORER_HEADER_CLASS_NAME.MENU_TRIGGER}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={active}
            accessKey={menu.accessKey}
            data-active={active}
            onClick={() => {
              const nextSourceId = sourceId(index);
              if (pointerSwitchedSourceRef.current === nextSourceId) {
                pointerSwitchedSourceRef.current = null;
                openMenu(index);
              } else if (active) {
                contextMenu.close();
              } else {
                openMenu(index);
              }
            }}
            onPointerEnter={() => {
              if (ownMenuOpen && !active) {
                pointerSwitchedSourceRef.current = sourceId(index);
                openMenu(index);
              }
            }}
            onKeyDown={(event) => handleTriggerKeyDown(event, index)}
          >
            {menu.label}
          </button>
        );
      })}
    </div>
  );
}

function wrapIndex(index: number, length: number): number {
  return length === 0 ? 0 : (index + length) % length;
}
