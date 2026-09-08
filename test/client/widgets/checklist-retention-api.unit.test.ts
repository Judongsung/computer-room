import { afterEach, describe, expect, it, vi } from "vitest";
import { checklistRetentionApi } from "@client/api/widgets/checklist-retention-api-client";
import { CHECKLIST_SETTINGS_API_PATH } from "@/constants/platform/api";

afterEach(() => vi.unstubAllGlobals());

describe("checklist retention HTTP contract", () => {
  it("reads and patches the existing settings envelope", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ settings: { retentionDays: null } }))
      .mockResolvedValueOnce(Response.json({ settings: { retentionDays: 90 } }));
    vi.stubGlobal("fetch", fetcher);
    expect(await checklistRetentionApi.getSettings()).toEqual({ retentionDays: null });
    expect(fetcher.mock.calls[0]?.[0]).toBe(CHECKLIST_SETTINGS_API_PATH);
    expect(await checklistRetentionApi.updateRetentionDays(90)).toEqual({ retentionDays: 90 });
    expect(fetcher).toHaveBeenLastCalledWith(CHECKLIST_SETTINGS_API_PATH,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ retentionDays: 90 }) }));
  });

  it.each([{}, { settings: {} }, { settings: { retentionDays: -1 } }, { settings: { retentionDays: "90" } }])("rejects invalid responses %j", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    await expect(checklistRetentionApi.getSettings()).rejects.toThrow();
  });

  it("propagates an HTTP failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "failed" }, { status: 500 })));
    await expect(checklistRetentionApi.updateRetentionDays(null)).rejects.toThrow();
  });
});
