import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@client/app";
import { SITE_COPY } from "@client/content/ko/widgets/content";
import { DESKTOP_LAYOUT } from "@client/constants/desktop/desktop";
import { detectClientInterfaceMode } from "@client/domain/platform/interface-mode";
import "./styles/global.css";

document.title = SITE_COPY.TITLE;
document.documentElement.dataset.interfaceMode = detectClientInterfaceMode();
const ROOT_DESKTOP_STYLE = {
  "--desktop-min-width": `${DESKTOP_LAYOUT.MIN_WIDTH_PX}px`,
  "--desktop-min-height": `${DESKTOP_LAYOUT.MIN_HEIGHT_PX}px`,
  "--taskbar-height": `${DESKTOP_LAYOUT.TASKBAR_HEIGHT_PX}px`,
  "--start-button-width": `${DESKTOP_LAYOUT.START_BUTTON_WIDTH_PX}px`,
  "--start-menu-width": `${DESKTOP_LAYOUT.START_MENU_WIDTH_PX}px`,
  "--start-menu-header-height": `${DESKTOP_LAYOUT.START_MENU_HEADER_HEIGHT_PX}px`,
  "--start-menu-content-min-height": `${DESKTOP_LAYOUT.START_MENU_CONTENT_MIN_HEIGHT_PX}px`,
  "--start-menu-footer-height": `${DESKTOP_LAYOUT.START_MENU_FOOTER_HEIGHT_PX}px`,
  "--xp-window-title-bar-height": `${DESKTOP_LAYOUT.WINDOW_TITLE_BAR_HEIGHT_PX}px`,
  "--xp-window-title-icon-size": `${DESKTOP_LAYOUT.WINDOW_TITLE_ICON_SIZE_PX}px`,
  "--xp-window-frame-border-width": `${DESKTOP_LAYOUT.WINDOW_FRAME_BORDER_WIDTH_PX}px`,
  "--xp-window-control-size": `${DESKTOP_LAYOUT.WINDOW_CONTROL_SIZE_PX}px`,
  "--xp-window-toolbar-height": `${DESKTOP_LAYOUT.WINDOW_TOOLBAR_HEIGHT_PX}px`,
  "--desktop-modal-viewport-margin": `${DESKTOP_LAYOUT.MODAL_VIEWPORT_MARGIN_PX}px`,
} as const;

for (const [property, value] of Object.entries(ROOT_DESKTOP_STYLE)) {
  document.documentElement.style.setProperty(property, value);
}
const root = document.createElement("div");
document.body.append(root);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
