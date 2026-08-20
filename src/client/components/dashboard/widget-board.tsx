import type { DashboardWidget } from "../../../types/widget";
import type { DashboardGateway } from "../../types/api";
import { DesktopWidgetGrid } from "./desktop-widget-grid";
import { EmptyBoard } from "./empty-board";
import { MobileWidgetList } from "./mobile-widget-list";

interface WidgetBoardProps {
  readonly widgets: readonly DashboardWidget[];
  readonly isDesktop: boolean;
  readonly isEditing: boolean;
  readonly onLayoutChange: (widgets: readonly DashboardWidget[]) => void;
  readonly onDelete: (id: string) => void;
  readonly gateway: DashboardGateway;
  readonly onWidgetChange: (widget: DashboardWidget) => void;
}

export function WidgetBoard({
  widgets,
  isDesktop,
  isEditing,
  onLayoutChange,
  onDelete,
  gateway,
  onWidgetChange,
}: WidgetBoardProps) {
  if (widgets.length === 0) {
    return <EmptyBoard />;
  }

  if (!isDesktop) {
    return (
      <MobileWidgetList
        widgets={widgets}
        gateway={gateway}
        onWidgetChange={onWidgetChange}
      />
    );
  }

  return (
    <DesktopWidgetGrid
      widgets={widgets}
      isEditing={isEditing}
      onLayoutChange={onLayoutChange}
      onDelete={onDelete}
      gateway={gateway}
      onWidgetChange={onWidgetChange}
    />
  );
}
