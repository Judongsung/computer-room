import { MEDIA_VIEWER_COPY } from "@client/content/ko/media/media";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  IMAGE_FULL_ROTATION_DEGREES,
  IMAGE_ROTATION_STEP_DEGREES,
  IMAGE_VIEWER_ZOOM,
  IMAGE_VIEWER_ZOOM_MODE,
  MEDIA_KEYBOARD_KEY,
  MEDIA_TOOLBAR_GLYPH,
  PERCENT_MULTIPLIER,
  PICTURE_VIEWER_CANVAS_PADDING_PX,
} from "@client/constants/media/media";
import { useElementSize } from "@client/hooks/shared/use-element-size";
import type {
  ImageViewerZoomMode,
  MediaFailureProps,
  MediaRendererProps,
  MediaViewerToolbarButtonProps,
} from "@client/types/media/media";

export function PictureViewer({
  file,
  sourceUrl,
  navigationError,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onDownload,
  onContextMenu,
}: MediaRendererProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasSize = useElementSize(canvasRef);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoomMode, setZoomMode] = useState<ImageViewerZoomMode>(
    IMAGE_VIEWER_ZOOM_MODE.FIT,
  );
  const [manualScale, setManualScale] = useState<number>(
    IMAGE_VIEWER_ZOOM.ACTUAL_SIZE,
  );
  const [rotation, setRotation] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setNaturalSize({ width: 0, height: 0 });
    setZoomMode(IMAGE_VIEWER_ZOOM_MODE.FIT);
    setManualScale(IMAGE_VIEWER_ZOOM.ACTUAL_SIZE);
    setRotation(0);
    setLoadFailed(false);
  }, [file.id]);

  const isQuarterTurn = Math.abs(rotation / IMAGE_ROTATION_STEP_DEGREES) % 2 === 1;
  const fitScale = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) {
      return IMAGE_VIEWER_ZOOM.ACTUAL_SIZE;
    }
    const width = isQuarterTurn ? naturalSize.height : naturalSize.width;
    const height = isQuarterTurn ? naturalSize.width : naturalSize.height;
    const availableWidth = canvasSize.width - PICTURE_VIEWER_CANVAS_PADDING_PX;
    const availableHeight = canvasSize.height - PICTURE_VIEWER_CANVAS_PADDING_PX;
    if (availableWidth <= 0 || availableHeight <= 0) {
      return IMAGE_VIEWER_ZOOM.ACTUAL_SIZE;
    }
    return Math.min(
      IMAGE_VIEWER_ZOOM.ACTUAL_SIZE,
      availableWidth / width,
      availableHeight / height,
    );
  }, [
    canvasSize.height,
    canvasSize.width,
    isQuarterTurn,
    naturalSize.height,
    naturalSize.width,
  ]);
  const scale =
    zoomMode === IMAGE_VIEWER_ZOOM_MODE.FIT ? fitScale : manualScale;
  const imageWidth = naturalSize.width * scale;
  const imageHeight = naturalSize.height * scale;
  const stageStyle = {
    width: `${isQuarterTurn ? imageHeight : imageWidth}px`,
    height: `${isQuarterTurn ? imageWidth : imageHeight}px`,
  } satisfies CSSProperties;
  const imageStyle = {
    width: `${imageWidth}px`,
    height: `${imageHeight}px`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  } satisfies CSSProperties;

  const zoom = (factor: number): void => {
    setManualScale(
      clampScale(
        (zoomMode === IMAGE_VIEWER_ZOOM_MODE.FIT ? fitScale : manualScale) *
          factor,
      ),
    );
    setZoomMode(IMAGE_VIEWER_ZOOM_MODE.MANUAL);
  };
  const rotate = (degrees: number): void => {
    setRotation(
      (current) => (current + degrees) % IMAGE_FULL_ROTATION_DEGREES,
    );
  };
  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === MEDIA_KEYBOARD_KEY.PREVIOUS && hasPrevious) {
      event.preventDefault();
      onPrevious();
      return;
    }
    if (event.key === MEDIA_KEYBOARD_KEY.NEXT && hasNext) {
      event.preventDefault();
      onNext();
      return;
    }
    if (
      event.key === MEDIA_KEYBOARD_KEY.ZOOM_IN ||
      event.key === MEDIA_KEYBOARD_KEY.ZOOM_IN_ALTERNATE
    ) {
      event.preventDefault();
      zoom(IMAGE_VIEWER_ZOOM.FACTOR);
      return;
    }
    if (event.key === MEDIA_KEYBOARD_KEY.ZOOM_OUT) {
      event.preventDefault();
      zoom(1 / IMAGE_VIEWER_ZOOM.FACTOR);
      return;
    }
    if (event.key === MEDIA_KEYBOARD_KEY.ACTUAL_SIZE) {
      event.preventDefault();
      setManualScale(IMAGE_VIEWER_ZOOM.ACTUAL_SIZE);
      setZoomMode(IMAGE_VIEWER_ZOOM_MODE.MANUAL);
    }
  };

  return (
    <div
      className="picture-viewer"
      tabIndex={0}
      onKeyDown={handleKeyboard}
      onContextMenu={onContextMenu}
    >
      <div className="picture-viewer__canvas" ref={canvasRef}>
        {!loadFailed ? (
          <div className="picture-viewer__stage" style={stageStyle}>
            <img
              src={sourceUrl}
              alt={file.name}
              draggable={false}
              style={imageStyle}
              onLoad={(event) =>
                setNaturalSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              onError={() => setLoadFailed(true)}
            />
          </div>
        ) : (
          <MediaFailure onDownload={onDownload} />
        )}
        {!naturalSize.width && !loadFailed ? (
          <p className="media-viewer__loading">{MEDIA_VIEWER_COPY.LOADING}</p>
        ) : null}
      </div>
      <div
        className="picture-viewer__toolbar"
        aria-label={MEDIA_VIEWER_COPY.PICTURE_TOOLBAR}
      >
        <ViewerButton label={MEDIA_VIEWER_COPY.PREVIOUS} glyph={MEDIA_TOOLBAR_GLYPH.PREVIOUS} disabled={!hasPrevious} onClick={onPrevious} />
        <ViewerButton label={MEDIA_VIEWER_COPY.NEXT} glyph={MEDIA_TOOLBAR_GLYPH.NEXT} disabled={!hasNext} onClick={onNext} />
        <span className="media-toolbar__separator" />
        <ViewerButton label={MEDIA_VIEWER_COPY.FIT_TO_WINDOW} glyph={MEDIA_TOOLBAR_GLYPH.FIT_TO_WINDOW} onClick={() => setZoomMode(IMAGE_VIEWER_ZOOM_MODE.FIT)} />
        <ViewerButton label={MEDIA_VIEWER_COPY.ACTUAL_SIZE} glyph={MEDIA_TOOLBAR_GLYPH.ACTUAL_SIZE} onClick={() => {
          setManualScale(IMAGE_VIEWER_ZOOM.ACTUAL_SIZE);
          setZoomMode(IMAGE_VIEWER_ZOOM_MODE.MANUAL);
        }} />
        <ViewerButton label={MEDIA_VIEWER_COPY.ZOOM_OUT} glyph={MEDIA_TOOLBAR_GLYPH.ZOOM_OUT} onClick={() => zoom(1 / IMAGE_VIEWER_ZOOM.FACTOR)} />
        <ViewerButton label={MEDIA_VIEWER_COPY.ZOOM_IN} glyph={MEDIA_TOOLBAR_GLYPH.ZOOM_IN} onClick={() => zoom(IMAGE_VIEWER_ZOOM.FACTOR)} />
        <span className="media-toolbar__separator" />
        <ViewerButton label={MEDIA_VIEWER_COPY.ROTATE_LEFT} glyph={MEDIA_TOOLBAR_GLYPH.ROTATE_LEFT} onClick={() => rotate(-IMAGE_ROTATION_STEP_DEGREES)} />
        <ViewerButton label={MEDIA_VIEWER_COPY.ROTATE_RIGHT} glyph={MEDIA_TOOLBAR_GLYPH.ROTATE_RIGHT} onClick={() => rotate(IMAGE_ROTATION_STEP_DEGREES)} />
        <span className="media-toolbar__spacer" />
        <output>{Math.round(scale * PERCENT_MULTIPLIER)}%</output>
        <ViewerButton label={MEDIA_VIEWER_COPY.DOWNLOAD} glyph={MEDIA_TOOLBAR_GLYPH.DOWNLOAD} onClick={onDownload} />
      </div>
      {navigationError ? <p className="media-viewer__notice" role="alert">{navigationError}</p> : null}
    </div>
  );
}

function ViewerButton({
  label,
  glyph,
  disabled = false,
  onClick,
}: MediaViewerToolbarButtonProps) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick}>
      {glyph}
    </button>
  );
}

function MediaFailure({ onDownload }: MediaFailureProps) {
  return (
    <div className="media-viewer__failure" role="alert">
      <p>{MEDIA_VIEWER_COPY.LOAD_FAILED}</p>
      <button type="button" onClick={onDownload}>{MEDIA_VIEWER_COPY.DOWNLOAD_FILE}</button>
    </div>
  );
}

function clampScale(scale: number): number {
  return Math.min(
    IMAGE_VIEWER_ZOOM.MAXIMUM,
    Math.max(IMAGE_VIEWER_ZOOM.MINIMUM, scale),
  );
}
