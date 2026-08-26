import { describe, expect, it } from "vitest";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { LOCAL_WIDGET_DRAFT_VERSION } from "@client/constants/widgets/local-widget-draft";
import {
  parseLocalWidgetDraft,
  resetLocalChecklistForKoreaDate,
} from "@client/domain/widgets/local-widget-draft";
import type { LocalChecklistWidgetDraft } from "@client/types/widgets/local-widget-draft";

const CHECKLIST_DRAFT: LocalChecklistWidgetDraft = {
  version: LOCAL_WIDGET_DRAFT_VERSION,
  id: "local-checklist",
  type: WIDGET_TYPE.DAILY_CHECKLIST,
  businessDate: "2026-08-25",
  items: [{ id: "item-1", label: "확인", checked: true }],
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
};

describe("local widget draft", () => {
  it("accepts the current version and rejects malformed checklist data", () => {
    expect(parseLocalWidgetDraft(CHECKLIST_DRAFT)).toEqual(CHECKLIST_DRAFT);
    expect(
      parseLocalWidgetDraft({
        ...CHECKLIST_DRAFT,
        items: [{ id: "item-1", label: "확인", checked: "yes" }],
      }),
    ).toBeNull();
  });

  it("resets checked state after Korean midnight", () => {
    const beforeMidnight = Date.parse("2026-08-25T14:59:59.000Z");
    const afterMidnight = Date.parse("2026-08-25T15:00:00.000Z");

    expect(resetLocalChecklistForKoreaDate(CHECKLIST_DRAFT, beforeMidnight)).toBe(
      CHECKLIST_DRAFT,
    );
    expect(
      resetLocalChecklistForKoreaDate(CHECKLIST_DRAFT, afterMidnight),
    ).toMatchObject({
      businessDate: "2026-08-26",
      items: [{ id: "item-1", label: "확인", checked: false }],
    });
  });
});
