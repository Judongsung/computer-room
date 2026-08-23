import { describe, expect, it } from "vitest";
import { ThumbnailLoadCoordinator } from "../../src/client/domain/thumbnail-load-coordinator";

describe("ThumbnailLoadCoordinator", () => {
  it("starts no more than four loads until a permit is released", async () => {
    const coordinator = new ThumbnailLoadCoordinator(4);
    const controllers = Array.from({ length: 5 }, () => new AbortController());
    const active = await Promise.all(
      controllers.slice(0, 4).map((controller) =>
        coordinator.acquire(controller.signal),
      ),
    );
    let fifthStarted = false;
    const fifth = coordinator.acquire(controllers[4]!.signal).then((permit) => {
      fifthStarted = true;
      return permit;
    });

    await Promise.resolve();
    expect(fifthStarted).toBe(false);
    active[0]?.release();
    const fifthPermit = await fifth;
    expect(fifthStarted).toBe(true);

    active.slice(1).forEach((permit) => permit?.release());
    fifthPermit?.release();
  });

  it("removes an aborted pending load without consuming a slot", async () => {
    const coordinator = new ThumbnailLoadCoordinator(1);
    const firstController = new AbortController();
    const first = await coordinator.acquire(firstController.signal);
    const cancelledController = new AbortController();
    const cancelled = coordinator.acquire(cancelledController.signal);

    cancelledController.abort();
    await expect(cancelled).resolves.toBeNull();
    first?.release();

    const next = await coordinator.acquire(new AbortController().signal);
    expect(next).not.toBeNull();
    next?.release();
  });
});
