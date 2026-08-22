import type { FilesystemFileEntry } from "../../types/filesystem";
import type { MediaKind } from "../../types/media";
import type { IMAGE_VIEWER_ZOOM_MODE } from "../constants/media";
import type {
  DesktopDimensions,
  ManagedDesktopWindowState,
  WindowBounds,
} from "./desktop";
import type { FilesystemGateway } from "./filesystem";

export type ImageViewerZoomMode =
  (typeof IMAGE_VIEWER_ZOOM_MODE)[keyof typeof IMAGE_VIEWER_ZOOM_MODE];

export interface MediaViewerOpenRequest {
  readonly entry: FilesystemFileEntry;
  readonly directoryId: string;
  readonly kind: MediaKind;
}

export interface MediaWindowState extends ManagedDesktopWindowState {
  readonly id: string;
  readonly directoryId: string;
  readonly currentFile: FilesystemFileEntry;
}

export interface MediaViewerWindowProps {
  readonly window: MediaWindowState;
  readonly desktop: DesktopDimensions;
  readonly gateway: FilesystemGateway;
  readonly filesystemRevision: number;
  readonly isActive: boolean;
  readonly zIndex: number;
  readonly onFocus: () => void;
  readonly onMinimize: () => void;
  readonly onToggleMaximize: () => void;
  readonly onClose: () => void;
  readonly onCommitBounds: (bounds: WindowBounds) => void;
  readonly onChangeFile: (entry: FilesystemFileEntry) => void;
}

export interface MediaRendererProps {
  readonly file: FilesystemFileEntry;
  readonly sourceUrl: string;
  readonly navigationError: string | null;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onDownload: () => void;
}

export interface MediaViewerToolbarButtonProps {
  readonly label: string;
  readonly glyph: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

export interface MediaFailureProps {
  readonly onDownload: () => void;
}
