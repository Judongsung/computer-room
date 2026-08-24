import { XP_WINDOW_INTERACTION_CLASS_NAME } from "@client/constants/shared/xp";
import type { XpWindowFrameProps } from "@client/types/shared/xp";

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
  const titleBarClasses = [
    XP_WINDOW_INTERACTION_CLASS_NAME.TITLE_BAR,
    titleBarClassName,
  ]
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
            className={XP_WINDOW_INTERACTION_CLASS_NAME.CONTROLS}
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
