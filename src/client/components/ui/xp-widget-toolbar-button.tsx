import type { ReactNode } from "react";
import { XP_WIDGET_TOOLBAR_ACTION } from "../../constants/xp";
import type {
  XpWidgetToolbarAction,
  XpWidgetToolbarButtonProps,
} from "../../types/xp";

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
