import { afterEach, expect, it, vi } from "vitest";
import { DashboardApiClient } from "@client/api/widgets/dashboard-api-client";
import { CLIENT_ERROR_CODE } from "@client/constants/shared/errors";

afterEach(() => vi.unstubAllGlobals());

it("requests owner memo versions through encoded widget paths", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [{ version: 2, savedAt: null }] }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ version: 2, savedAt: null, markdown: "old" }) });
  vi.stubGlobal("fetch", fetch);
  const client = new DashboardApiClient();
  await expect(client.listMemoVersions("memo/id")).resolves.toEqual({ items: [{ version: 2, savedAt: null }] });
  await expect(client.getMemoVersion("memo/id", 2)).resolves.toEqual({ version: 2, savedAt: null, markdown: "old" });
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([
    "/api/widgets/memo%2Fid/memo/versions",
    "/api/widgets/memo%2Fid/memo/versions/2",
  ]);
});

it("rejects malformed and mismatched history responses", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [{ version: "2", savedAt: null }] }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ version: 1, savedAt: null, markdown: "wrong" }) });
  vi.stubGlobal("fetch", fetch);
  const client = new DashboardApiClient();
  await expect(client.listMemoVersions("memo")).rejects.toMatchObject({ code: CLIENT_ERROR_CODE.INVALID_RESPONSE });
  await expect(client.getMemoVersion("memo", 2)).rejects.toMatchObject({ code: CLIENT_ERROR_CODE.INVALID_RESPONSE });
});
