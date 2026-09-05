import type { ReactNode } from "react";
import { XP_WIDGET_TOOLBAR_ACTION } from "@client/constants/shared/xp";
import type {
  XpWidgetToolbarAction,
  XpWidgetToolbarButtonProps,
} from "@client/types/shared/xp";

const ICON_BY_ACTION = {
  [XP_WIDGET_TOOLBAR_ACTION.EDIT]: (
    <>
      <path d="M2 1.5h8l3 3V14H2Z" fill="#fff" stroke="#7694ad" />
      <path d="M3 3h6M3 5h5M3 7h3" stroke="#c3d9ec" />
      <path
        d="m3 11 7.6-7.6 2 2L5 13H3v-2Z"
        fill="#ffd45c"
        stroke="#99691e"
      />
      <path d="m9.8 4.2 2 2" stroke="#fff" />
    </>
  ),
  [XP_WIDGET_TOOLBAR_ACTION.COMPLETE]: (
    <>
    <circle cx="8" cy="8" r="6.5" fill="#55aa32" stroke="#286b17" />
    <path d="M3 6a5 5 0 0 1 8-2" fill="none" stroke="#b8e787" />
    <path
      d="m3 8 3 3 7-7"
      fill="none"
      stroke="#fff"
      strokeLinecap="square"
      strokeWidth="2.2"
    />
    </>
  ),
  [XP_WIDGET_TOOLBAR_ACTION.HISTORY]: (
    <>
      <circle cx="8" cy="8" r="6.5" fill="#70ade0" stroke="#365b8d" />
      <circle cx="8" cy="8" r="5" fill="#fffef0" stroke="#d5e7f5" />
      <path d="M8 4V8l2.5 1.5" fill="none" stroke="#304563" strokeWidth="1.2" />
      <path d="M8 3v1m4 4h1m-5 4v1M3 8h1" stroke="#7e94a4" />
    </>
  ),
  [XP_WIDGET_TOOLBAR_ACTION.SAVE_FILE]: (
    <>
      <path d="M3 2h9l2 2v10H2V2h1Z" fill="#4f75ba" stroke="#12345b" />
      <path d="M5 2h6v4H5V2Zm0 8h6v4H5v-4Z" fill="#fff" stroke="#12345b" />
      <path d="M3 3v10M4 7h8" stroke="#8fb8eb" />
      <path d="M9 2v3M6 11h4M6 12.5h4" stroke="#92a3b5" />
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
