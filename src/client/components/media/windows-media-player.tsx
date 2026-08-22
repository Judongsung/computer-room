import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  MEDIA_SEEK_STEP_SECONDS,
  MEDIA_SECONDS_PER_MINUTE,
  MEDIA_TIME_FALLBACK_SECONDS,
  MEDIA_TIME_PAD_CHARACTER,
  MEDIA_TIME_PAD_LENGTH,
  MEDIA_TOOLBAR_GLYPH,
  MEDIA_VIEWER_COPY,
  MEDIA_VOLUME_RANGE,
} from "../../constants/media";
import type { MediaRendererProps } from "../../types/media";

export function WindowsMediaPlayer({
  file,
  sourceUrl,
  navigationError,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onDownload,
}: MediaRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(MEDIA_TIME_FALLBACK_SECONDS);
  const [duration, setDuration] = useState(MEDIA_TIME_FALLBACK_SECONDS);
  const [volume, setVolume] = useState<number>(MEDIA_VOLUME_RANGE.MAXIMUM);
  const [isMuted, setIsMuted] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    setIsPlaying(false);
    setCurrentTime(MEDIA_TIME_FALLBACK_SECONDS);
    setDuration(MEDIA_TIME_FALLBACK_SECONDS);
    setLoadFailed(false);
    return () => {
      video?.pause();
    };
  }, [file.id]);

  const togglePlayback = (): void => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setLoadFailed(true));
    } else {
      video.pause();
    }
  };
  const seek = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = Number(event.target.value);
    if (videoRef.current) videoRef.current.currentTime = next;
    setCurrentTime(next);
  };
  const changeVolume = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = Number(event.target.value);
    if (videoRef.current) {
      videoRef.current.volume = next;
      videoRef.current.muted = false;
    }
    setVolume(next);
    setIsMuted(false);
  };
  const toggleMute = (): void => {
    const next = !isMuted;
    if (videoRef.current) videoRef.current.muted = next;
    setIsMuted(next);
  };
  const enterFullscreen = (): void => {
    void videoRef.current?.requestFullscreen?.();
  };

  return (
    <div className="windows-media-player">
      <div className="windows-media-player__brandbar">
        <strong>{MEDIA_VIEWER_COPY.PLAYER_BRAND}</strong>
        <span>{file.name}</span>
      </div>
      <div className="windows-media-player__screen">
        {!loadFailed ? (
          <video
            ref={videoRef}
            src={sourceUrl}
            preload="metadata"
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => {
              const nextDuration = event.currentTarget.duration;
              setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
            }}
            onEnded={() => setIsPlaying(false)}
            onError={() => setLoadFailed(true)}
          />
        ) : (
          <div className="media-viewer__failure" role="alert">
            <p>{MEDIA_VIEWER_COPY.LOAD_FAILED}</p>
            <button type="button" onClick={onDownload}>{MEDIA_VIEWER_COPY.DOWNLOAD_FILE}</button>
          </div>
        )}
      </div>
      <div className="windows-media-player__seek">
        <input
          type="range"
          aria-label={MEDIA_VIEWER_COPY.SEEK}
          min={MEDIA_TIME_FALLBACK_SECONDS}
          max={duration || MEDIA_TIME_FALLBACK_SECONDS}
          step={MEDIA_SEEK_STEP_SECONDS}
          value={Math.min(currentTime, duration || MEDIA_TIME_FALLBACK_SECONDS)}
          disabled={!duration || loadFailed}
          onChange={seek}
        />
        <output>{formatTime(currentTime)} / {formatTime(duration)}</output>
      </div>
      <div className="windows-media-player__controls">
        <button type="button" aria-label={MEDIA_VIEWER_COPY.PREVIOUS} title={MEDIA_VIEWER_COPY.PREVIOUS} disabled={!hasPrevious} onClick={onPrevious}>{MEDIA_TOOLBAR_GLYPH.PREVIOUS}</button>
        <button className="windows-media-player__play" type="button" aria-label={isPlaying ? MEDIA_VIEWER_COPY.PAUSE : MEDIA_VIEWER_COPY.PLAY} title={isPlaying ? MEDIA_VIEWER_COPY.PAUSE : MEDIA_VIEWER_COPY.PLAY} disabled={loadFailed} onClick={togglePlayback}>{isPlaying ? MEDIA_TOOLBAR_GLYPH.PAUSE : MEDIA_TOOLBAR_GLYPH.PLAY}</button>
        <button type="button" aria-label={MEDIA_VIEWER_COPY.NEXT} title={MEDIA_VIEWER_COPY.NEXT} disabled={!hasNext} onClick={onNext}>{MEDIA_TOOLBAR_GLYPH.NEXT}</button>
        <span className="windows-media-player__status">{isPlaying ? MEDIA_VIEWER_COPY.PLAY : MEDIA_VIEWER_COPY.PLAYER_STATUS_READY}</span>
        <button type="button" aria-label={isMuted ? MEDIA_VIEWER_COPY.UNMUTE : MEDIA_VIEWER_COPY.MUTE} title={isMuted ? MEDIA_VIEWER_COPY.UNMUTE : MEDIA_VIEWER_COPY.MUTE} onClick={toggleMute}>{isMuted ? MEDIA_TOOLBAR_GLYPH.UNMUTE : MEDIA_TOOLBAR_GLYPH.MUTE}</button>
        <input
          className="windows-media-player__volume"
          type="range"
          aria-label={MEDIA_VIEWER_COPY.VOLUME}
          min={MEDIA_VOLUME_RANGE.MINIMUM}
          max={MEDIA_VOLUME_RANGE.MAXIMUM}
          step={MEDIA_VOLUME_RANGE.STEP}
          value={volume}
          onChange={changeVolume}
        />
        <button type="button" aria-label={MEDIA_VIEWER_COPY.FULLSCREEN} title={MEDIA_VIEWER_COPY.FULLSCREEN} disabled={loadFailed} onClick={enterFullscreen}>{MEDIA_TOOLBAR_GLYPH.FULLSCREEN}</button>
        <button type="button" aria-label={MEDIA_VIEWER_COPY.DOWNLOAD} title={MEDIA_VIEWER_COPY.DOWNLOAD} onClick={onDownload}>{MEDIA_TOOLBAR_GLYPH.DOWNLOAD}</button>
      </div>
      {navigationError ? <p className="media-viewer__notice" role="alert">{navigationError}</p> : null}
    </div>
  );
}

function formatTime(value: number): string {
  const safeValue = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const minutes = Math.floor(safeValue / MEDIA_SECONDS_PER_MINUTE);
  const seconds = String(safeValue % MEDIA_SECONDS_PER_MINUTE).padStart(
    MEDIA_TIME_PAD_LENGTH,
    MEDIA_TIME_PAD_CHARACTER,
  );
  return `${minutes}:${seconds}`;
}
