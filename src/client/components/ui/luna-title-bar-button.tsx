import type { ReactNode } from "react";
import { LUNA_TITLE_BAR_ACTION } from "../../constants/luna";
import type {
  LunaTitleBarAction,
  LunaTitleBarButtonProps,
} from "../../types/luna";

const ICON_BY_ACTION = {
  [LUNA_TITLE_BAR_ACTION.EDIT]: (
    <>
      <path
        d="m3 11 7.6-7.6 2 2L5 13H3v-2Z"
        fill="#ffd45c"
        stroke="#12345b"
      />
      <path d="m9.8 4.2 2 2" stroke="#fff" />
    </>
  ),
  [LUNA_TITLE_BAR_ACTION.COMPLETE]: (
    <path
      d="m3 8 3 3 7-7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth="2.2"
    />
  ),
  [LUNA_TITLE_BAR_ACTION.HISTORY]: (
    <>
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" />
      <path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" />
    </>
  ),
  [LUNA_TITLE_BAR_ACTION.CLOSE]: (
    <path
      d="m4 4 8 8m0-8-8 8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth="2"
    />
  ),
} as const satisfies Record<LunaTitleBarAction, ReactNode>;

export function LunaTitleBarButton({
  action,
  label,
  className,
  type = "button",
  ...buttonProps
}: LunaTitleBarButtonProps) {
  const classes = [
    "luna-title-bar-button",
    `luna-title-bar-button--${action}`,
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
    </button>
  );
}
