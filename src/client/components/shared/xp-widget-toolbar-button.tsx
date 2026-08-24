import type { ReactNode } from "react";
import { XP_WIDGET_TOOLBAR_ACTION } from "@client/constants/shared/xp";
import type {
  XpWidgetToolbarAction,
  XpWidgetToolbarButtonProps,
} from "@client/types/shared/xp";

const ICON_BY_ACTION = {
  [XP_WIDGET_TOOLBAR_ACTION.EDIT]: (
    <>
      <path
        d="m3 11 7.6-7.6 2 2L5 13H3v-2Z"
        fill="#ffd45c"
        stroke="#12345b"
      />
      <path d="m9.8 4.2 2 2" stroke="#fff" />
    </>
  ),
  [XP_WIDGET_TOOLBAR_ACTION.COMPLETE]: (
    <path
      d="m3 8 3 3 7-7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth="2.2"
    />
  ),
  [XP_WIDGET_TOOLBAR_ACTION.HISTORY]: (
    <>
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" />
      <path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" />
    </>
  ),
  [XP_WIDGET_TOOLBAR_ACTION.SAVE_FILE]: (
    <>
      <path d="M3 2h9l2 2v10H2V2h1Z" fill="#4f75ba" stroke="#12345b" />
      <path d="M5 2h6v4H5V2Zm0 8h6v4H5v-4Z" fill="#fff" stroke="#12345b" />
    </>
  ),
  [XP_WIDGET_TOOLBAR_ACTION.REFRESH]: (
    <>
      <path
        d="M13 7A5 5 0 1 0 11.5 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M10 3h3v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
} as const satisfies Record<XpWidgetToolbarAction, ReactNode>;

export function XpWidgetToolbarButton({
  action,
  label,
  className,
  type = "button",
  ...buttonProps
}: XpWidgetToolbarButtonProps) {
  const classes = [
    "xp-widget-toolbar-button",
    `xp-widget-toolbar-button--${action}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...buttonProps}
      className={classes}
      type={type}
      aria-label={label}
      title={label}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16">
        {ICON_BY_ACTION[action]}
      </svg>
      <span>{label}</span>
    </button>
  );
}
