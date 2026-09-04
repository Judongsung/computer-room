import type { ManagedDesktopWindowState } from "@client/types/desktop/desktop";

export interface DesktopWindowRegistration {
  readonly id: string;
  readonly title: string;
  readonly iconPath: string;
  readonly windowState: ManagedDesktopWindowState["windowState"];
  readonly minimize: () => void;
  readonly restore: () => void;
  readonly toggleMaximize: () => void;
  readonly close?: () => void;
  readonly focus?: () => void;
}
