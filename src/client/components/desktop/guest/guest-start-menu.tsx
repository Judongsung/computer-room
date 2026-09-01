import { useEffect, useRef } from "react";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import { DASHBOARD_COPY } from "@client/content/ko/widgets/content";

interface GuestStartMenuProps {
  readonly open: boolean;
  readonly loginUrl: string;
  readonly repositoryUrl: string;
  readonly onClose: () => void;
}

export function GuestStartMenu({
  open,
  loginUrl,
  repositoryUrl,
  onClose,
}: GuestStartMenuProps) {
  const menuRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeFromPointer = (event: PointerEvent): void => {
      const target = event.target;
      if (
        target instanceof Element &&
        (menuRef.current?.contains(target) || target.closest("[data-start-button]"))
      ) {
        return;
      }
      onClose();
    };
    const closeFromKeyboard = (event: KeyboardEvent): void => {
      if (event.key === KEYBOARD_KEY.ESCAPE) onClose();
    };
    document.addEventListener("pointerdown", closeFromPointer);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromPointer);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <aside ref={menuRef} className="start-menu guest-start-menu">
      <header className="start-menu__user">
        <img src={DESKTOP_ASSET_PATHS.START_LOGO} alt="" />
        <strong>{GUEST_COPY.GUEST_ACCOUNT}</strong>
      </header>
      <div className="guest-start-menu__content">
        <div className="start-menu__system-item">
          <img src={DESKTOP_ASSET_PATHS.DOCUMENTS_ICON} alt="" />
          <span>
            <strong>{GUEST_COPY.PUBLIC_SPACE}</strong>
            <small>{GUEST_COPY.START_MENU_DESCRIPTION}</small>
          </span>
        </div>
        <a
          className="start-menu__system-item start-menu__system-link"
          href={repositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
        >
          <img src={DESKTOP_ASSET_PATHS.INTERNET_ICON} alt="" />
          <span>
            <strong>{DASHBOARD_COPY.GITHUB_REPOSITORY}</strong>
            <small>{DASHBOARD_COPY.GITHUB_REPOSITORY_DESCRIPTION}</small>
          </span>
        </a>
      </div>
      <footer className="start-menu__footer">
        <a className="start-menu__power" href={loginUrl}>
          <img src={DESKTOP_ASSET_PATHS.POWER_ICON} alt="" />
          <strong>{GUEST_COPY.LOGIN}</strong>
        </a>
      </footer>
    </aside>
  );
}
