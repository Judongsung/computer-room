import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from "react";
import {
  XP_WIDGET_TOOLBAR_ACTION,
  XP_WINDOW_CONTROL_ACTION,
} from "../constants/xp";

export type XpWindowControlAction =
  (typeof XP_WINDOW_CONTROL_ACTION)[keyof typeof XP_WINDOW_CONTROL_ACTION];

export type XpWidgetToolbarAction =
  (typeof XP_WIDGET_TOOLBAR_ACTION)[keyof typeof XP_WIDGET_TOOLBAR_ACTION];

export interface XpWindowControlButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "aria-label" | "children"
  > {
  readonly action: XpWindowControlAction;
  readonly label: string;
}

export interface XpWidgetToolbarButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "aria-label" | "children"
  > {
  readonly action: XpWidgetToolbarAction;
  readonly label: string;
}

export interface XpWindowFrameProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  readonly title: string;
  readonly titleId?: string;
  readonly iconPath?: string;
  readonly isActive?: boolean;
  readonly controls?: ReactNode;
  readonly toolbar?: ReactNode;
  readonly footer?: ReactNode;
  readonly bodyClassName?: string;
  readonly titleBarClassName?: string;
  readonly onTitleBarDoubleClick?: MouseEventHandler<HTMLElement>;
  readonly children: ReactNode;
}
