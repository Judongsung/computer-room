import type { BackgroundTaskScheduler } from "@/types/platform/runtime";
import type { ScheduledJob } from "@/types/platform/scheduled-job";

export class ScheduledJobDispatcher {
  private readonly jobs: readonly ScheduledJob[];

  constructor(
    private readonly backgroundTasks: BackgroundTaskScheduler,
    jobs: readonly ScheduledJob[],
  ) {
    this.jobs = [...jobs];
  }

  dispatch(scheduledTime: number): void {
    for (const job of this.jobs) {
      const task = Promise.resolve().then(() => job.run(scheduledTime));
      this.backgroundTasks.schedule(task, job.failureCode);
    }
  }
}
