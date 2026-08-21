import type { XpWindowControlButtonProps } from "../../types/xp";

export function XpWindowControlButton({
  action,
  label,
  className,
  type = "button",
  ...buttonProps
}: XpWindowControlButtonProps) {
  const classes = [
    "xp-window-control-button",
    `xp-window-control-button--${action}`,
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
      <span className="xp-window-control-button__glyph" aria-hidden="true" />
    </button>
  );
}
