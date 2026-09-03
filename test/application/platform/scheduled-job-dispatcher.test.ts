import { describe, expect, it, vi } from "vitest";
import { ScheduledJobDispatcher } from "@/application/platform/scheduled-job-dispatcher";
import type { BackgroundTaskScheduler } from "@/types/platform/runtime";
import type { ScheduledJob } from "@/types/platform/scheduled-job";

describe("ScheduledJobDispatcher", () => {
  it("registers every job independently with the same scheduled time", async () => {
    const scheduledTime = 1_788_188_400_000;
    const backgroundTasks = new CapturingBackgroundTaskScheduler();
    const successfulRun = vi.fn(async () => "done");
    const jobs: ScheduledJob[] = [
      {
        failureCode: "FIRST_JOB_FAILED",
        run: () => {
          throw new Error("synchronous failure");
        },
      },
      {
        failureCode: "SECOND_JOB_FAILED",
        run: successfulRun,
      },
    ];

    new ScheduledJobDispatcher(backgroundTasks, jobs).dispatch(scheduledTime);

    expect(backgroundTasks.failureCodes).toEqual([
      "FIRST_JOB_FAILED",
      "SECOND_JOB_FAILED",
    ]);
    expect(backgroundTasks.tasks).toHaveLength(2);
    await expect(Promise.allSettled(backgroundTasks.tasks)).resolves.toEqual([
      expect.objectContaining({ status: "rejected" }),
      expect.objectContaining({ status: "fulfilled" }),
    ]);
    expect(successfulRun).toHaveBeenCalledWith(scheduledTime);
  });

  it("keeps an immutable snapshot of the registered jobs", () => {
    const backgroundTasks = new CapturingBackgroundTaskScheduler();
    const jobs: ScheduledJob[] = [];
    const dispatcher = new ScheduledJobDispatcher(backgroundTasks, jobs);
    jobs.push({ failureCode: "LATE_JOB", run: async () => undefined });

    dispatcher.dispatch(100);

    expect(backgroundTasks.tasks).toHaveLength(0);
  });
});

class CapturingBackgroundTaskScheduler implements BackgroundTaskScheduler {
  readonly tasks: Promise<unknown>[] = [];
  readonly failureCodes: string[] = [];

  schedule(task: Promise<unknown>, failureCode: string): void {
    this.tasks.push(task);
    this.failureCodes.push(failureCode);
  }
}
