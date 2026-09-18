import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { useEffect, useRef } from "react";
import { DASHBOARD_COPY } from "@client/content/ko/widgets/content";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import {
  DESKTOP_APPLICATION_CATALOG,
} from "@client/constants/desktop/application-catalog";
import { APPLICATION_LAUNCH_LOCATION } from "@client/constants/desktop/application";
import { APPLICATION_NAME_BY_TYPE } from "@client/content/ko/desktop/application";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";
import type { StartMenuProps } from "@client/types/desktop/desktop";
import { useXpContextMenu } from "@client/state/context-menu/context-menu-context";
import { contextMenuCommand } from "@client/domain/context-menu/context-menu";
import { AccessLogoutLink } from "@client/components/shared/access-logout-link";
import { ACCESS_COPY } from "@client/content/ko/platform/access";

export function StartMenu({
  isOpen,
  email,
  logoutUrl,
  repositoryUrl,
  onClose,
  onLaunchApplication,
  onSearch,
}: StartMenuProps) {
  const contextMenu = useXpContextMenu();
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
      if (event.key === KEYBOARD_KEY.ESCAPE) {
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
          {DESKTOP_APPLICATION_CATALOG.filter(({ launchLocations }) =>
            launchLocations.includes(APPLICATION_LAUNCH_LOCATION.START_MENU),
          ).map(({ type, iconPath, contextCommandId }) => {
            const launch = (): void => onLaunchApplication(type);
            return (
              <button
                key={type}
                type="button"
                className="start-menu__item"
                onClick={launch}
                onContextMenu={(event) =>
                  contextMenu.openFromEvent(event, [
                    contextMenuCommand(
                      contextCommandId,
                      APPLICATION_NAME_BY_TYPE[type],
                      launch,
                    ),
                  ])
                }
              >
                <img src={iconPath} alt="" />
                <span>{APPLICATION_NAME_BY_TYPE[type]}</span>
              </button>
            );
          })}
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
          <button type="button" className="start-menu__item" onClick={onSearch}>
            <img src={DESKTOP_ASSET_PATHS.FOLDER_ICON} alt="" />
            <span>{FILESYSTEM_SEARCH_COPY.TITLE}</span>
          </button>
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
        </section>
      </div>
      <footer className="start-menu__footer">
        <AccessLogoutLink
          className="start-menu__power"
          logoutUrl={logoutUrl}
          title={DASHBOARD_COPY.POWER_DESCRIPTION}
          pendingChildren={
            <>
              <img src={DESKTOP_ASSET_PATHS.POWER_ICON} alt="" />
              <strong>{ACCESS_COPY.LOGGING_OUT}</strong>
            </>
          }
        >
          <img src={DESKTOP_ASSET_PATHS.POWER_ICON} alt="" />
          <strong>{DASHBOARD_COPY.POWER}</strong>
        </AccessLogoutLink>
      </footer>
    </aside>
  );
}
