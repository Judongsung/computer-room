import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "@/index";
import { resetWorkerState } from "@test/support/http/worker-api-harness";
import { CapturingExecutionContext } from "@test/support/platform/runtime-fakes";

const SCHEDULED_TIME = Date.parse("2026-08-30T15:00:00.000Z");
const RETENTION_CUTOFF = Date.parse("2026-08-23T15:00:00.000Z");
const RETAINED_R2_KEY = "scheduled-test/retained-image";

beforeEach(resetWorkerState);

describe("scheduled jobs", () => {
  it("purges only expired image logs without touching R2 objects", async () => {
    await env.DB
      .prepare(
        "UPDATE integration_image_upload_log_settings SET retention_days = 7 WHERE singleton_id = 1",
      )
      .run();
    await Promise.all([
      insertFailureLog("expired", RETENTION_CUTOFF - 1),
      insertFailureLog("boundary", RETENTION_CUTOFF),
      insertFailureLog("recent", SCHEDULED_TIME - 1),
      env.FILES.put(RETAINED_R2_KEY, "image"),
    ]);
    const context = new CapturingExecutionContext();

    worker.scheduled(
      {
        cron: "0 15 * * *",
        scheduledTime: SCHEDULED_TIME,
        noRetry: () => undefined,
      } as ScheduledController,
      env,
      context.value,
    );
    await context.settle();

    const logs = await env.DB
      .prepare(
        "SELECT id FROM integration_image_upload_logs ORDER BY received_at ASC",
      )
      .all<{ readonly id: string }>();
    expect(logs.results.map(({ id }) => id)).toEqual(["boundary", "recent"]);
    expect(await env.FILES.get(RETAINED_R2_KEY)).not.toBeNull();
  });
});

async function insertFailureLog(id: string, receivedAt: number): Promise<void> {
  await env.DB
    .prepare(
      `INSERT INTO integration_image_upload_logs (
         id, profile_id, outcome, content_type, declared_size,
         file_entry_id, file_name, http_status, error_code, error_message,
         received_at, duration_ms
       ) VALUES (?1, 'novelai', 'failure', 'image/png', 1,
                 NULL, NULL, 500, 'TEST_FAILURE', 'Test failure', ?2, 1)`,
    )
    .bind(id, receivedAt)
    .run();
}
