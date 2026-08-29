import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { XP_CONTEXT_MENU_LAYOUT } from "@client/constants/context-menu/context-menu";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { focusXpContextMenuItem } from "@client/state/context-menu/context-menu-keyboard";
import {
  fallbackContextMenuItems,
  semanticContextMenuItems,
} from "@client/state/context-menu/context-menu-items";
import type { PreservedEditableTarget } from "@client/state/context-menu/editable-selection";
import type {
  XpContextMenuController,
  XpContextMenuRequest,
} from "@client/types/context-menu/context-menu";

interface XpContextMenuRuntime {
  readonly controller: XpContextMenuController;
  readonly request: XpContextMenuRequest | null;
  readonly position: { readonly x: number; readonly y: number };
  readonly error: string | null;
  readonly menuRef: RefObject<HTMLDivElement | null>;
}

export function useXpContextMenuRuntime(): XpContextMenuRuntime {
  const [request, setRequest] = useState<XpContextMenuRequest | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const editableTargetRef = useRef<PreservedEditableTarget | null>(null);

  const close = useCallback(() => setRequest(null), []);
  const reportError = useCallback((message: string) => setError(message), []);
  const open = useCallback((next: XpContextMenuRequest) => {
    setPosition({ x: next.x, y: next.y });
    setRequest(next);
  }, []);
  const openFromEvent = useCallback<XpContextMenuController["openFromEvent"]>(
    (event, items, label) => {
      event.preventDefault();
      event.stopPropagation();
      const semanticItems = semanticContextMenuItems(
        event.target ?? null,
        editableTargetRef,
        reportError,
      );
      open({
        x: event.clientX,
        y: event.clientY,
        items: semanticItems ?? items,
        ...(label ? { label } : {}),
      });
    },
    [open, reportError],
  );

  const controller = useMemo<XpContextMenuController>(
    () => ({ open, openFromEvent, close, reportError }),
    [close, open, openFromEvent, reportError],
  );

  useGlobalContextMenu(open, reportError, editableTargetRef);
  useContextMenuDismissal(request, close, menuRef);
  useContextMenuPosition(request, menuRef, setPosition);
  useTransientContextMenuError(error, setError);

  return { controller, request, position, error, menuRef };
}

function useGlobalContextMenu(
  open: XpContextMenuController["open"],
  reportError: XpContextMenuController["reportError"],
  editableTargetRef: RefObject<PreservedEditableTarget | null>,
): void {
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      open({
        x: event.clientX,
        y: event.clientY,
        items: fallbackContextMenuItems(
          event.target,
          editableTargetRef,
          reportError,
        ),
      });
    };
    const handleKeyboardMenu = (event: KeyboardEvent): void => {
      if (
        event.key !== KEYBOARD_KEY.CONTEXT_MENU &&
        !(event.shiftKey && event.key === KEYBOARD_KEY.F10)
      ) {
        return;
      }
      event.preventDefault();
      const target = document.activeElement ?? document.body;
      const rect =
        target instanceof Element
          ? target.getBoundingClientRect()
          : document.body.getBoundingClientRect();
      target.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + Math.min(rect.width, 16),
          clientY: rect.bottom,
        }),
      );
    };
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyboardMenu);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyboardMenu);
    };
  }, [editableTargetRef, open, reportError]);
}

function useContextMenuDismissal(
  request: XpContextMenuRequest | null,
  close: () => void,
  menuRef: RefObject<HTMLDivElement | null>,
): void {
  useEffect(() => {
    if (!request) return undefined;
    const closeFromPointer = (event: PointerEvent): void => {
      if (
        !(event.target instanceof Node) ||
        !menuRef.current?.contains(event.target)
      ) {
        close();
      }
    };
    const closeFromKeyboard = (event: KeyboardEvent): void => {
      if (event.key === KEYBOARD_KEY.ESCAPE) close();
    };
    document.addEventListener("pointerdown", closeFromPointer, true);
    document.addEventListener("keydown", closeFromKeyboard);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", closeFromPointer, true);
      document.removeEventListener("keydown", closeFromKeyboard);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [close, menuRef, request]);
}

function useContextMenuPosition(
  request: XpContextMenuRequest | null,
  menuRef: RefObject<HTMLDivElement | null>,
  setPosition: (position: { readonly x: number; readonly y: number }) => void,
): void {
  useEffect(() => {
    if (!request || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const margin = XP_CONTEXT_MENU_LAYOUT.VIEWPORT_MARGIN_PX;
    setPosition({
      x: clampMenuCoordinate(request.x, rect.width, window.innerWidth, margin),
      y: clampMenuCoordinate(request.y, rect.height, window.innerHeight, margin),
    });
    focusXpContextMenuItem(menuRef.current, 0);
  }, [menuRef, request, setPosition]);
}

function useTransientContextMenuError(
  error: string | null,
  setError: (error: string | null) => void,
): void {
  useEffect(() => {
    if (!error) return undefined;
    const timeout = window.setTimeout(
      () => setError(null),
      XP_CONTEXT_MENU_LAYOUT.ERROR_DURATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [error, setError]);
}

function clampMenuCoordinate(
  origin: number,
  size: number,
  viewport: number,
  margin: number,
): number {
  const flipped = origin + size + margin > viewport ? origin - size : origin;
  return Math.max(margin, Math.min(flipped, viewport - size - margin));
}
