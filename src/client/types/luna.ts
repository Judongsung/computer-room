import type { ButtonHTMLAttributes } from "react";
import { LUNA_TITLE_BAR_ACTION } from "../constants/luna";

export type LunaTitleBarAction =
  (typeof LUNA_TITLE_BAR_ACTION)[keyof typeof LUNA_TITLE_BAR_ACTION];

export interface LunaTitleBarButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "aria-label" | "children"
  > {
  readonly action: LunaTitleBarAction;
  readonly label: string;
}
