import { afterEach, describe, expect, it, vi } from "vitest";
import { BACKGROUND_TASK_LOG_EVENT } from "@/constants/platform/background-task";
import { CloudflareBackgroundTaskScheduler } from "@/infrastructure/platform/cloudflare-background-task-scheduler";
import { CapturingExecutionContext } from "@test/support/platform/runtime-fakes";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CloudflareBackgroundTaskScheduler", () => {
  it("registers successful work without emitting an error", async () => {
    const context = new CapturingExecutionContext();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    new CloudflareBackgroundTaskScheduler(context.value).schedule(
      Promise.resolve("done"),
      "SUCCESS_JOB_FAILED",
    );

    await context.settle();
    expect(context.tasks).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
  });

  it("emits only the safe job failure identity", async () => {
    const context = new CapturingExecutionContext();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    new CloudflareBackgroundTaskScheduler(context.value).schedule(
      Promise.reject(new Error("private failure detail")),
      "EXPECTED_JOB_FAILED",
    );

    await context.settle();
    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      JSON.stringify({
        event: BACKGROUND_TASK_LOG_EVENT,
        code: "EXPECTED_JOB_FAILED",
      }),
    );
    expect(error.mock.calls.flat().join(" ")).not.toContain(
      "private failure detail",
    );
  });
});
