import { vi } from "vitest";
import type { ChecklistRetentionUseCases } from "@/types/widgets/checklist/retention";

export function fakeChecklistRetentionGateway() {
  return {
    getSettings: vi.fn<ChecklistRetentionUseCases["getSettings"]>(async () => ({ retentionDays: null })),
    updateRetentionDays: vi.fn<ChecklistRetentionUseCases["updateRetentionDays"]>(async (retentionDays) => ({ retentionDays })),
  } satisfies ChecklistRetentionUseCases;
}
