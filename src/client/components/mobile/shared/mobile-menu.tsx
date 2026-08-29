import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { useEffect, type ReactNode } from "react";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { MOBILE_CLASS_NAME } from "@client/constants/shared/mobile";

interface MobileMenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function MobileMenu({ open, onClose, children }: MobileMenuProps) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === KEYBOARD_KEY.ESCAPE) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className={MOBILE_CLASS_NAME.MENU}>
      <button
        className={MOBILE_CLASS_NAME.MENU_BACKDROP}
        type="button"
        aria-label={MOBILE_COPY.CLOSE_MENU}
        onClick={onClose}
      />
      <menu className={MOBILE_CLASS_NAME.MENU_PANEL}>{children}</menu>
    </div>
  );
}
