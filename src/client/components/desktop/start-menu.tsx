import { useEffect, useRef } from "react";
import { DASHBOARD_COPY } from "../../constants/content";
import {
  DESKTOP_ASSET_PATHS,
  WIDGET_ICON_PATH_BY_TYPE,
} from "../../constants/desktop";
import { WIDGET_TYPE } from "../../../constants/widget";
import type { StartMenuProps } from "../../types/desktop";

export function StartMenu({
  isOpen,
  email,
  logoutUrl,
  onClose,
  onAddMemo,
  onAddChecklist,
}: StartMenuProps) {
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
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
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("pointerdown", closeFromPointer);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromPointer);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      ref={menuRef}
      className="start-menu"
      aria-label={DASHBOARD_COPY.START_MENU}
    >
      <header className="start-menu__user">
        <img src={DESKTOP_ASSET_PATHS.START_LOGO} alt="" />
        <strong>{email}</strong>
      </header>
      <div className="start-menu__content">
        <section
          className="start-menu__programs"
          aria-label={DASHBOARD_COPY.PROGRAMS}
        >
          <h2 className="start-menu__section-title">
            {DASHBOARD_COPY.PROGRAMS}
          </h2>
          <button
            type="button"
            className="start-menu__item"
            onClick={onAddMemo}
          >
            <img src={WIDGET_ICON_PATH_BY_TYPE[WIDGET_TYPE.MEMO]} alt="" />
            <span>{DASHBOARD_COPY.ADD_MEMO_WIDGET}</span>
          </button>
          <button
            type="button"
            className="start-menu__item"
            onClick={onAddChecklist}
          >
            <img
              src={WIDGET_ICON_PATH_BY_TYPE[WIDGET_TYPE.DAILY_CHECKLIST]}
              alt=""
            />
            <span>{DASHBOARD_COPY.ADD_CHECKLIST_WIDGET}</span>
          </button>
        </section>
        <section
          className="start-menu__system"
          aria-label={DASHBOARD_COPY.PERSONAL_SPACE}
        >
          <div className="start-menu__system-item">
            <img src={DESKTOP_ASSET_PATHS.START_LOGO} alt="" />
            <span>
              <strong>{DASHBOARD_COPY.PERSONAL_SPACE}</strong>
              <small>{DASHBOARD_COPY.ACCESS_PROTECTED}</small>
            </span>
          </div>
        </section>
      </div>
      <footer className="start-menu__footer">
        <a
          className="start-menu__power"
          href={logoutUrl}
          title={DASHBOARD_COPY.POWER_DESCRIPTION}
        >
          <img src={DESKTOP_ASSET_PATHS.POWER_ICON} alt="" />
          <strong>{DASHBOARD_COPY.POWER}</strong>
        </a>
      </footer>
    </aside>
  );
}
