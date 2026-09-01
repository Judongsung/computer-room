import { useEffect, useId, useRef, type MouseEvent } from "react";
import {
  DESKTOP_MODAL_CLASS_NAME,
  DESKTOP_MODAL_VARIANT,
} from "@client/constants/desktop/modal";
import { XP_WINDOW_CONTROL_ACTION } from "@client/constants/shared/xp";
import { DASHBOARD_COPY } from "@client/content/ko/widgets/content";
import { useDesktopModalDrag } from "@client/hooks/desktop/use-desktop-modal-drag";
import type { DesktopModalProps } from "@client/types/desktop/modal";
import { XpWindowControlButton } from "@client/components/shared/xp-window-control-button";
import { XpWindowFrame } from "@client/components/desktop/xp-window-frame";

export function DesktopModal({
  title,
  iconPath,
  variant = DESKTOP_MODAL_VARIANT.STANDARD,
  className,
  windowClassName,
  bodyClassName,
  footer,
  closeOnBackdrop = false,
  onRequestClose,
  closeDisabled = false,
  children,
}: DesktopModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const drag = useDesktopModalDrag(dialogRef);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    return () => {
      if (typeof dialog.close === "function" && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    };
  }, []);

  const handleMouseDown = (event: MouseEvent<HTMLDialogElement>): void => {
    event.stopPropagation();
    if (
      !closeOnBackdrop ||
      !onRequestClose ||
      closeDisabled ||
      event.target !== event.currentTarget
    ) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom;
    if (!inside) onRequestClose();
  };

  const classes = [
    DESKTOP_MODAL_CLASS_NAME.ROOT,
    `${DESKTOP_MODAL_CLASS_NAME.VARIANT_PREFIX}${variant}`,
    drag.position ? DESKTOP_MODAL_CLASS_NAME.POSITIONED : null,
    drag.isDragging ? DESKTOP_MODAL_CLASS_NAME.DRAGGING : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const windowClasses = [
    DESKTOP_MODAL_CLASS_NAME.WINDOW,
    windowClassName,
  ]
    .filter(Boolean)
    .join(" ");
  const bodyClasses = [DESKTOP_MODAL_CLASS_NAME.BODY, bodyClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <dialog
      ref={dialogRef}
      className={classes}
      aria-labelledby={titleId}
      aria-modal="true"
      style={
        drag.position
          ? { left: drag.position.x, top: drag.position.y }
          : undefined
      }
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onRequestClose?.();
      }}
      onMouseDown={handleMouseDown}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
      onLostPointerCapture={drag.onLostPointerCapture}
    >
      <XpWindowFrame
        className={windowClasses}
        title={title}
        titleId={titleId}
        {...(iconPath ? { iconPath } : {})}
        bodyClassName={bodyClasses}
        footer={footer}
        controls={
          onRequestClose ? (
            <XpWindowControlButton
              action={XP_WINDOW_CONTROL_ACTION.CLOSE}
              label={DASHBOARD_COPY.CLOSE}
              disabled={closeDisabled}
              onClick={onRequestClose}
            />
          ) : undefined
        }
      >
        {children}
      </XpWindowFrame>
    </dialog>
  );
}
