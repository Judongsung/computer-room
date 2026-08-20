import type { ReactNode } from "react";
import { LUNA_TITLE_BAR_ACTION } from "../../constants/luna";
import { WIDGET_COPY } from "../../constants/content";
import { LunaTitleBarButton } from "../ui/luna-title-bar-button";

interface WidgetCardProps {
  readonly title: string;
  readonly deleteLabel: string;
  readonly isEditingLayout: boolean;
  readonly onDelete: () => void;
  readonly headerActions?: ReactNode;
  readonly children: ReactNode;
}

export function WidgetCard({
  title,
  deleteLabel,
  isEditingLayout,
  onDelete,
  headerActions,
  children,
}: WidgetCardProps) {
  return (
    <article className="widget-card window">
      <header
        className={
          isEditingLayout
            ? "widget-card__header title-bar widget-card__drag-handle"
            : "widget-card__header title-bar"
        }
      >
        <strong className="title-bar-text">{title}</strong>
        <div className="widget-card__header-actions title-bar-controls">
          {!isEditingLayout ? headerActions : null}
          {isEditingLayout ? (
            <LunaTitleBarButton
              action={LUNA_TITLE_BAR_ACTION.CLOSE}
              label={deleteLabel}
              onClick={() => {
                if (window.confirm(WIDGET_COPY.DELETE_CONFIRM)) {
                  onDelete();
                }
              }}
            />
          ) : null}
        </div>
      </header>
      <div className="widget-card__body window-body">{children}</div>
    </article>
  );
}
