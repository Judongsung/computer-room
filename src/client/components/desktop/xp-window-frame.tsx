import type { XpWindowFrameProps } from "../../types/xp";

export function XpWindowFrame({
  title,
  titleId,
  iconPath,
  isActive = true,
  controls,
  toolbar,
  footer,
  bodyClassName,
  titleBarClassName,
  onTitleBarDoubleClick,
  className,
  children,
  ...sectionProps
}: XpWindowFrameProps) {
  const frameClasses = [
    "xp-window-frame",
    isActive ? "xp-window-frame--active" : "xp-window-frame--inactive",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const titleBarClasses = ["xp-window-frame__title-bar", titleBarClassName]
    .filter(Boolean)
    .join(" ");
  const bodyClasses = ["xp-window-frame__body", bodyClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <section {...sectionProps} className={frameClasses}>
      <div className="xp-window-frame__title-background" aria-hidden="true" />
      <header
        className={titleBarClasses}
        onDoubleClick={onTitleBarDoubleClick}
      >
        {iconPath ? (
          <img
            className="xp-window-frame__title-icon"
            src={iconPath}
            alt=""
            draggable={false}
          />
        ) : null}
        <strong className="xp-window-frame__title" id={titleId}>
          {title}
        </strong>
        {controls ? (
          <div
            className="xp-window-frame__controls"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {controls}
          </div>
        ) : null}
      </header>
      {toolbar ? (
        <div className="xp-window-frame__toolbar">{toolbar}</div>
      ) : null}
      <div className={bodyClasses}>{children}</div>
      {footer}
    </section>
  );
}
