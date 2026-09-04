import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";
import type { DesktopDimensions, ManagedDesktopWindowState, WindowBounds } from "@client/types/desktop/desktop";
import type { DesktopWindowRegistration } from "@client/types/desktop/session/window-registration";
import type { FileDownloadSource } from "@client/types/filesystem/text/files";

export interface NotepadWindowState extends ManagedDesktopWindowState {
  readonly id: string;
  readonly file: FilesystemFileEntry;
}
export interface NotepadWindowController {
  readonly windows: readonly NotepadWindowState[];
  readonly registrations: readonly DesktopWindowRegistration[];
  open(file: FilesystemFileEntry, desktop: DesktopDimensions): string;
  close(id: string): void;
  minimize(id: string): void;
  restore(id: string): void;
  toggleMaximize(id: string): void;
  commitBounds(id: string, bounds: WindowBounds): void;
}
export interface NotepadWindowLayerProps {
  readonly controller: NotepadWindowController;
  readonly gateway: FileDownloadSource;
  readonly desktop: DesktopDimensions;
  readonly manager: {
    readonly activeWindowId: string | null;
    readonly zOrders: Readonly<Record<string, number>>;
    focus(id: string): void;
    clearActive(id?: string): void;
    minimize(id: string): void;
    toggleMaximize(id: string): void;
  };
}
