import { env, SELF } from "cloudflare:test";
import { expect, it } from "vitest";
import { API_PATHS, API_PATH_SEGMENTS } from "@/constants/platform/api";
import { HTTP_METHOD, HTTP_STATUS } from "@/constants/platform/http";
import { ORIGIN, jsonRequest } from "@test/support/http/worker-api-harness";

it("validates repeat settings and hydrates them without writes on GET", async () => {
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO dashboard_widgets(id,type,position_x,position_y,width,height,stack_order)
    VALUES (?1,'daily-checklist',0,0,360,300,0)`).bind(id).run();
  const path = `${API_PATHS.WIDGETS}/${id}/${API_PATH_SEGMENTS.CHECKLIST}`;
  for (const body of [{}, {repeatCycle:"yearly"}, {repeatCycle:1}, null]) {
    expect((await jsonRequest(path, HTTP_METHOD.PATCH, body)).status).toBe(HTTP_STATUS.BAD_REQUEST);
  }
  const response = await jsonRequest(path, HTTP_METHOD.PATCH, {repeatCycle:"weekly"});
  expect(response.status).toBe(HTTP_STATUS.OK);
  expect(await response.json()).toMatchObject({repeatCycle:"weekly",items:[]});
  const before = await env.DB.prepare("SELECT * FROM checklist_repeat_settings WHERE widget_id = ?1").bind(id).first();
  expect(await (await SELF.fetch(`${ORIGIN}${path}`)).json()).toMatchObject({repeatCycle:"weekly"});
  expect(await env.DB.prepare("SELECT * FROM checklist_repeat_settings WHERE widget_id = ?1").bind(id).first()).toEqual(before);
  expect((await SELF.fetch(`https://private.example${path}`, {method:HTTP_METHOD.PATCH})).status).toBe(HTTP_STATUS.FORBIDDEN);
  await env.DB.prepare("DELETE FROM dashboard_widgets WHERE id = ?1").bind(id).run();
});
