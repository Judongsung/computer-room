import { vi } from "vitest";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type { GuestProgramDocument, GuestSessionInfo } from "@/types/guest/guest";
import type { FilesystemDirectoryPage } from "@/types/filesystem/filesystem";

export function program(id: string, label = id): Extract<GuestProgramDocument, { type: typeof WIDGET_TYPE.DAILY_CHECKLIST }> {
  return {
    entry: { id, parentId: "desktop", kind: FILESYSTEM_ENTRY_KIND.WIDGET, name: id,
      widgetId: id, widgetType: WIDGET_TYPE.DAILY_CHECKLIST, createdAt: "", updatedAt: "", desktopOrder: null },
    type: WIDGET_TYPE.DAILY_CHECKLIST,
    data: { businessDate: "2026-09-08", nextResetAt: "2099-01-01T00:00:00Z", repeatCycle: "daily",
      items: [{ id: "item", label, checked: false }] },
  };
}

export function guestGateway() {
  return {
    getProgramDocument: vi.fn<(id: string) => Promise<GuestProgramDocument>>(async (id) => program(id)),
    getSession: vi.fn<() => Promise<GuestSessionInfo>>(),
    listDirectory: vi.fn<(id: string, offset?: number) => Promise<FilesystemDirectoryPage>>(),
    downloadUrl: vi.fn<(id: string) => string>(), contentUrl: vi.fn<(id: string) => string>(), thumbnailUrl: vi.fn<(id: string) => string>(),
  };
}
