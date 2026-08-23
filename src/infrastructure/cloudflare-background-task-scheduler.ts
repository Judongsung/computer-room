import type { BackgroundTaskScheduler } from "../types/runtime";
import { BACKGROUND_TASK_LOG_EVENT } from "../constants/background-task";

export class CloudflareBackgroundTaskScheduler
  implements BackgroundTaskScheduler
{
  constructor(private readonly context: ExecutionContext) {}

  schedule(task: Promise<unknown>, failureCode: string): void {
    this.context.waitUntil(
      task.catch(() => {
        console.error(
          JSON.stringify({
            event: BACKGROUND_TASK_LOG_EVENT,
            code: failureCode,
          }),
        );
      }),
    );
  }
}
