import type { WidgetLayout } from "../../../types/widget";
import { DesktopWidgetGrid } from "./desktop-widget-grid";
import { EmptyBoard } from "./empty-board";
import { MobileWidgetList } from "./mobile-widget-list";

interface WidgetBoardProps {
  readonly widgets: readonly WidgetLayout[];
  readonly isDesktop: boolean;
  readonly isEditing: boolean;
  readonly onLayoutChange: (widgets: readonly WidgetLayout[]) => void;
  readonly onDelete: (id: string) => void;
}

export function WidgetBoard({
  widgets,
  isDesktop,
  isEditing,
  onLayoutChange,
  onDelete,
}: WidgetBoardProps) {
  if (widgets.length === 0) {
    return <EmptyBoard />;
  }

  if (!isDesktop) {
    return <MobileWidgetList widgets={widgets} />;
  }

  return (
    <DesktopWidgetGrid
      widgets={widgets}
      isEditing={isEditing}
      onLayoutChange={onLayoutChange}
      onDelete={onDelete}
    />
  );
}
