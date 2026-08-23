import type {
  ThumbnailLoadPermit,
  ThumbnailLoadScheduler,
} from "../types/thumbnail";

interface PendingThumbnailLoad {
  readonly signal: AbortSignal;
  readonly resolve: (permit: ThumbnailLoadPermit | null) => void;
  readonly abort: () => void;
}

export class ThumbnailLoadCoordinator implements ThumbnailLoadScheduler {
  private activeCount = 0;
  private readonly pending: PendingThumbnailLoad[] = [];

  constructor(private readonly maximumConcurrentLoads: number) {
    if (
      !Number.isSafeInteger(maximumConcurrentLoads) ||
      maximumConcurrentLoads < 1
    ) {
      throw new RangeError("maximumConcurrentLoads must be a positive integer");
    }
  }

  acquire(signal: AbortSignal): Promise<ThumbnailLoadPermit | null> {
    if (signal.aborted) return Promise.resolve(null);

    return new Promise((resolve) => {
      const pending: PendingThumbnailLoad = {
        signal,
        resolve,
        abort: () => {
          const index = this.pending.indexOf(pending);
          if (index >= 0) this.pending.splice(index, 1);
          resolve(null);
        },
      };
      signal.addEventListener("abort", pending.abort, { once: true });
      this.pending.push(pending);
      this.startPendingLoads();
    });
  }

  private startPendingLoads(): void {
    while (
      this.activeCount < this.maximumConcurrentLoads &&
      this.pending.length > 0
    ) {
      const pending = this.pending.shift();
      if (!pending) return;
      pending.signal.removeEventListener("abort", pending.abort);
      if (pending.signal.aborted) {
        pending.resolve(null);
        continue;
      }

      this.activeCount += 1;
      let released = false;
      pending.resolve({
        release: () => {
          if (released) return;
          released = true;
          this.activeCount -= 1;
          this.startPendingLoads();
        },
      });
    }
  }
}
