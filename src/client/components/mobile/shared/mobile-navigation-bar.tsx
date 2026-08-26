import {
  MOBILE_CLASS_NAME,
  MOBILE_COPY,
  MOBILE_NAVIGATION_GLYPH,
} from "@client/constants/shared/mobile";

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
      <button
        className={MOBILE_CLASS_NAME.NAVIGATION_BUTTON}
        type="button"
        aria-label={MOBILE_COPY.BACK}
        disabled={!canGoBack}
        onClick={onBack}
      >
        <span aria-hidden="true">{MOBILE_NAVIGATION_GLYPH.BACK}</span>
        <small>{MOBILE_COPY.BACK}</small>
      </button>
      <button
        className={MOBILE_CLASS_NAME.NAVIGATION_BUTTON}
        type="button"
        aria-label={MOBILE_COPY.HOME}
        onClick={onHome}
      >
        <span aria-hidden="true">{MOBILE_NAVIGATION_GLYPH.HOME}</span>
        <small>{MOBILE_COPY.HOME}</small>
      </button>
      <button
        className={MOBILE_CLASS_NAME.NAVIGATION_BUTTON}
        type="button"
        aria-label={MOBILE_COPY.MENU}
        aria-expanded={menuEnabled ? menuOpen : undefined}
        disabled={!menuEnabled}
        onClick={onMenu}
      >
        <span aria-hidden="true">{MOBILE_NAVIGATION_GLYPH.MENU}</span>
        <small>{MOBILE_COPY.MENU}</small>
      </button>
    </nav>
  );
}
