import { env, SELF } from "cloudflare:test";
import { beforeEach, expect, it } from "vitest";
import { CHECKLIST_SETTINGS_API_PATH } from "@/constants/platform/api";
import { HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { ORIGIN, jsonRequest } from "@test/support/http/worker-api-harness";

beforeEach(async () => {
  await env.DB.prepare("UPDATE checklist_settings SET retention_days = NULL WHERE singleton_id = 1").run();
});

it("reads unlimited by default, saves finite periods, and returns to unlimited", async () => {
  const url = `${ORIGIN}${CHECKLIST_SETTINGS_API_PATH}`;
  const response = await SELF.fetch(url);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ settings: { retentionDays: null } });
  for (const retentionDays of [30, 3650, null]) {
    const saved = await jsonRequest(CHECKLIST_SETTINGS_API_PATH, HTTP_METHOD.PATCH, { retentionDays });
    expect(saved.status).toBe(HTTP_STATUS.OK);
    expect(await saved.json()).toEqual({ settings: { retentionDays } });
    expect(await (await SELF.fetch(url)).json()).toEqual({ settings: { retentionDays } });
  }
});

it.each([{}, { retentionDays: "30" }, { retentionDays: 0 }, { retentionDays: 1.5 }, { retentionDays: 3651 }])(
  "rejects invalid retention input %s", async (body) => {
    const response = await jsonRequest(CHECKLIST_SETTINGS_API_PATH, HTTP_METHOD.PATCH, body);
    expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(await env.DB.prepare("SELECT retention_days FROM checklist_settings").first())
      .toEqual({ retention_days: null });
  },
);

it("keeps settings behind owner authentication and rejects cross-origin writes", async () => {
  expect((await SELF.fetch(`https://private.example${CHECKLIST_SETTINGS_API_PATH}`)).status)
    .toBe(HTTP_STATUS.FORBIDDEN);
  expect((await SELF.fetch(`${ORIGIN}${CHECKLIST_SETTINGS_API_PATH}`, {
    method: HTTP_METHOD.PATCH,
    headers: { "Content-Type": "application/json", Origin: "https://foreign.example" },
    body: JSON.stringify({ retentionDays: 30 }),
  })).status)
    .toBe(HTTP_STATUS.FORBIDDEN);
});
