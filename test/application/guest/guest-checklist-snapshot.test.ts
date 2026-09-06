import { describe, expect, it, vi } from "vitest";
import { GuestService } from "@/application/guest/guest-service";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { GuestPublicationRepository } from "@/types/guest/guest-repository";
import { filesystemEntryRecord } from "@test/support/filesystem/filesystem-entry-record";
import { CHECKLIST_READ_BOUNDARIES, checklistReadFixture } from "@test/support/widgets/checklist-read-fixture";

describe("guest checklist read snapshots", () => {
  it.each(CHECKLIST_READ_BOUNDARIES)("keeps the captured $cycle period across publication data reads", async ({ cycle, before, boundary, businessDate }) => {
    const { clock, checklists, widget, publicItem } = await checklistReadFixture(before, businessDate, cycle);
    const record = filesystemEntryRecord("published-entry", FILESYSTEM_ENTRY_KIND.WIDGET, "공개 체크리스트", {
      widgetId: widget.id, widgetType: WIDGET_TYPE.DAILY_CHECKLIST,
    });
    const listChecklistItems = vi.fn((id: string, date: string) => checklists.listActiveItems(id, date));
    const unexpected = async (): Promise<never> => { throw new Error("Unexpected repository operation"); };
    const publications: GuestPublicationRepository = {
      isGuestAccessEnabled: async () => true,
      findPublishedEntry: async () => record,
      checklistRepeatCycle: async () => {
        await Promise.resolve();
        clock.timestamp = Date.parse(boundary);
        return cycle;
      },
      listChecklistItems,
      findVisibleDirectory: unexpected,
      listVisibleChildren: unexpected,
      listBreadcrumbs: unexpected,
      findMemo: unexpected,
    };
    const service = new GuestService(publications, { find: unexpected, save: unexpected },
      { downloadFile: unexpected, streamFile: unexpected }, { getThumbnail: unexpected }, clock);
    const document = await service.getProgramDocument(record.id);

    expect(document.type).toBe(WIDGET_TYPE.DAILY_CHECKLIST);
    expect(document.data).toEqual({ repeatCycle: cycle, businessDate, nextResetAt: boundary, items: [publicItem] });
    expect(listChecklistItems).toHaveBeenCalledWith(widget.id, businessDate);
  });
});
