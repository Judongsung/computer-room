import { describe, expect, it } from "vitest";
import {
  CHECKLIST_LOG_PAGE_LIMIT,
  FILESYSTEM_PAGE_LIMIT,
} from "@/constants/filesystem/pagination";

describe("pagination policy", () => {
  it("keeps filesystem pages at 100 without changing unrelated APIs", () => {
    expect(FILESYSTEM_PAGE_LIMIT).toBe(100);
    expect(CHECKLIST_LOG_PAGE_LIMIT).toBe(50);
  });
});
