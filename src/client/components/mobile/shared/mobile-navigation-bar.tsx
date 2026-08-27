import {
  useRef,
  type MouseEventHandler,
  type PointerEventHandler,
} from "react";
import {
  MOBILE_CLASS_NAME,
  MOBILE_COPY,
  MOBILE_NAVIGATION_GLYPH,
} from "@client/constants/shared/mobile";
import { POINTER_TYPE } from "@client/constants/shared/pointer";

interface MobileNavigationBarProps {
  readonly canGoBack: boolean;
  readonly menuEnabled: boolean;
  readonly menuOpen: boolean;
  readonly onBack: () => void;
  readonly onHome: () => void;
  readonly onMenu: () => void;
}

export function MobileNavigationBar({
  canGoBack,
  menuEnabled,
  menuOpen,
  onBack,
  onHome,
  onMenu,
}: MobileNavigationBarProps) {
  return (
    <nav className={MOBILE_CLASS_NAME.NAVIGATION} aria-label={MOBILE_COPY.NAVIGATION_LABEL}>
      <MobileNavigationButton
        label={MOBILE_COPY.BACK}
        glyph={MOBILE_NAVIGATION_GLYPH.BACK}
        disabled={!canGoBack}
        onActivate={onBack}
      />
      <MobileNavigationButton
        label={MOBILE_COPY.HOME}
        glyph={MOBILE_NAVIGATION_GLYPH.HOME}
        onActivate={onHome}
      />
      <MobileNavigationButton
        label={MOBILE_COPY.MENU}
        glyph={MOBILE_NAVIGATION_GLYPH.MENU}
        expanded={menuEnabled ? menuOpen : undefined}
        disabled={!menuEnabled}
        onActivate={onMenu}
      />
    </nav>
  );
}

interface MobileNavigationButtonProps {
  readonly label: string;
  readonly glyph: string;
  readonly disabled?: boolean;
  readonly expanded?: boolean | undefined;
  readonly onActivate: () => void;
}

function MobileNavigationButton({
  label,
  glyph,
  disabled = false,
  expanded,
  onActivate,
}: MobileNavigationButtonProps) {
  const pendingTouchClickPointerId = useRef<number | null>(null);

  const onPointerDown: PointerEventHandler<HTMLButtonElement> = () => {
    pendingTouchClickPointerId.current = null;
  };
  const onPointerUp: PointerEventHandler<HTMLButtonElement> = (event) => {
    if (
      disabled ||
      event.pointerType !== POINTER_TYPE.TOUCH ||
      event.isPrimary === false
    ) {
      return;
    }
    pendingTouchClickPointerId.current = event.pointerId;
    onActivate();
  };
  const onClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (
      isMatchingTouchClick(event.nativeEvent, pendingTouchClickPointerId.current)
    ) {
      pendingTouchClickPointerId.current = null;
      return;
    }
    pendingTouchClickPointerId.current = null;
    onActivate();
  };

  return (
    <button
      className={MOBILE_CLASS_NAME.NAVIGATION_BUTTON}
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={onClick}
    >
      <span aria-hidden="true">{glyph}</span>
      <small>{label}</small>
    </button>
  );
}

function isMatchingTouchClick(
  event: MouseEvent,
  pointerId: number | null,
): boolean {
  if (pointerId === null || event.detail === 0) return false;
  if (!("pointerType" in event) || !("pointerId" in event)) return true;
  return (
    event.pointerType === POINTER_TYPE.TOUCH && event.pointerId === pointerId
  );
}
