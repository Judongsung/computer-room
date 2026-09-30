import { describe, expect, it } from "vitest";
import { STORAGE_USAGE_LEVEL } from "@client/constants/storage/storage-status";
import {
  storageGraphPercent,
  storageUsageLevel,
  storageUsagePercent,
} from "@client/domain/storage/storage-status";

describe("storage status calculations", () => {
  it("classifies zero, warning, limit, and over-limit usage", () => {
    expect(storageUsagePercent(0, 10)).toBe(0);
    expect(storageUsageLevel(79.9)).toBe(STORAGE_USAGE_LEVEL.NORMAL);
    expect(storageUsageLevel(80)).toBe(STORAGE_USAGE_LEVEL.WARNING);
    expect(storageUsageLevel(100)).toBe(STORAGE_USAGE_LEVEL.EXCEEDED);
    expect(storageUsageLevel(125)).toBe(STORAGE_USAGE_LEVEL.EXCEEDED);
    expect(storageGraphPercent(0, 0)).toBe(0);
    expect(storageGraphPercent(25, 100)).toBe(25);
  });
});
