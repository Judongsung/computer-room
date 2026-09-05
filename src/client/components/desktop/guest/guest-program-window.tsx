import { ProgramStatusBar } from "@client/components/desktop/application/program-status-bar";
import { PROGRAM_DOCUMENT_COPY as COPY } from "@client/content/ko/desktop/program-documents";
import { WIDGET_TYPE, WIDGET_WINDOW_POLICY } from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";
import { DesktopAppWindow } from "@client/components/desktop/desktop-app-window";
import { ReadOnlyProgramContent } from "@client/components/widgets/read-only-program-content";
import { WIDGET_ICON_PATH_BY_TYPE } from "@client/constants/desktop/desktop";
import { GUEST_DESKTOP_CLASS_NAME } from "@client/constants/guest/guest";
import { GUEST_COPY } from "@client/content/ko/guest/guest";
import type {
  DesktopDimensions,
  WindowBounds,
} from "@client/types/desktop/desktop";

interface GuestProgramWindowProps {
  readonly widget: DashboardWidget;
  readonly desktop: DesktopDimensions;
  readonly isActive: boolean;
  readonly zIndex: number;
  readonly onFocus: () => void;
  readonly onMinimize: () => void;
  readonly onToggleMaximize: () => void;
  readonly onClose: () => void;
  readonly onCommitBounds: (bounds: WindowBounds) => void;
}

export function GuestProgramWindow({
  widget,
  desktop,
  isActive,
  zIndex,
  onFocus,
  onMinimize,
  onToggleMaximize,
  onClose,
  onCommitBounds,
}: GuestProgramWindowProps) {
  if (
    widget.type !== WIDGET_TYPE.MEMO &&
    widget.type !== WIDGET_TYPE.DAILY_CHECKLIST
  ) {
    return null;
  }
  const policy = WIDGET_WINDOW_POLICY[widget.type];
  return (
    <DesktopAppWindow
      title={widget.file?.name ?? GUEST_COPY.PUBLIC_SPACE}
      iconPath={WIDGET_ICON_PATH_BY_TYPE[widget.type]}
      window={widget}
      desktop={desktop}
      isActive={isActive}
      zIndex={zIndex}
      minWidth={policy.MIN_WIDTH}
      minHeight={policy.MIN_HEIGHT}
      className={`widget-card guest-program-window desktop-program desktop-program--${widget.type === WIDGET_TYPE.MEMO ? "memo" : "checklist"}`}
      footer={<ProgramStatusBar primary={COPY.READ_ONLY} secondary={widget.type === WIDGET_TYPE.MEMO ? COPY.MARKDOWN : COPY.COMPLETED(widget.data.items.filter((item) => item.checked).length, widget.data.items.length)} />}
      bodyClassName={GUEST_DESKTOP_CLASS_NAME.PROGRAM_BODY}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onToggleMaximize={onToggleMaximize}
      onClose={onClose}
      onCommitBounds={onCommitBounds}
    >
      <ReadOnlyProgramContent program={widget} />
    </DesktopAppWindow>
  );
}
