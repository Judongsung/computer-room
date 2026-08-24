export interface ThumbnailLoadPermit {
  release(): void;
}

export interface ThumbnailLoadScheduler {
  acquire(signal: AbortSignal): Promise<ThumbnailLoadPermit | null>;
}
