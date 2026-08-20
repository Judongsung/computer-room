import { BLANK_WIDGET_COPY } from "../../constants/content";

interface BlankWidgetProps {
  readonly isEditing: boolean;
  readonly onDelete: () => void;
}

export function BlankWidget({ isEditing, onDelete }: BlankWidgetProps) {
  return (
    <article className="widget-card">
      <header
        className={
          isEditing
            ? "widget-card__header widget-card__drag-handle"
            : "widget-card__header"
        }
      >
        <strong>{BLANK_WIDGET_COPY.TITLE}</strong>
        {isEditing ? (
          <button
            className="widget-card__action"
            type="button"
            onClick={onDelete}
            aria-label={BLANK_WIDGET_COPY.DELETE_LABEL}
          >
            {BLANK_WIDGET_COPY.DELETE}
          </button>
        ) : null}
      </header>
      <div className="widget-card__body">
        <span>{BLANK_WIDGET_COPY.EMPTY_CONTENT}</span>
      </div>
    </article>
  );
}
