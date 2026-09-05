import { vi } from "vitest";
import { NATIVE_FILE_DRAG_DATA_TYPE } from "@client/constants/filesystem/drag";
import { DESKTOP_DRAG_DATA_TYPE } from "@client/constants/desktop/desktop";
import type { DragFilesystemEntryPayload } from "@client/types/filesystem/filesystem";

export function dragTransfer(payload?: DragFilesystemEntryPayload, files: readonly File[] = []) {
  const data = new Map<string, string>();
  const transfer = {
    get types() { return [...data.keys(), ...(files.length ? [NATIVE_FILE_DRAG_DATA_TYPE] : [])]; },
    effectAllowed: "uninitialized",
    dropEffect: "none",
    files,
    items: files.map((file) => ({ kind: "file", type: file.type, getAsFile: () => file })),
    setData: (type: string, value: string) => { data.set(type, value); },
    getData: vi.fn((type: string) => data.get(type) ?? ""),
  };
  if (payload) transfer.setData(DESKTOP_DRAG_DATA_TYPE, JSON.stringify(payload));
  return transfer as unknown as DataTransfer & { getData: typeof transfer.getData };
}
