import { describe, expect, it } from "vitest";
import { desktopIconLayout } from "@client/domain/desktop/desktop-icon-layout";

describe("desktopIconLayout", () => {
  it("flows fixed and dynamic icons from top to bottom before adding columns", () => {
    expect(desktopIconLayout({ width: 1_024, height: 606 })).toEqual({
      rowCount: 6,
      columnCount: 10,
      dynamicCapacity: 57,
    });
  });

  it("exposes fewer dynamic slots when the work area shrinks", () => {
    const large = desktopIconLayout({ width: 1_440, height: 866 });
    const medium = desktopIconLayout({ width: 1_280, height: 686 });
    const small = desktopIconLayout({ width: 1_024, height: 606 });

    expect(medium).toEqual({
      rowCount: 7,
      columnCount: 12,
      dynamicCapacity: 81,
    });
    expect(large).toEqual({
      rowCount: 9,
      columnCount: 14,
      dynamicCapacity: 123,
    });
    expect(large.dynamicCapacity).toBeGreaterThan(small.dynamicCapacity);
  });

  it("reserves only the fixed shortcuts supplied by each desktop mode", () => {
    const owner = desktopIconLayout({ width: 1_024, height: 606 });
    const guest = desktopIconLayout({ width: 1_024, height: 606 }, 1);

    expect(guest.dynamicCapacity).toBe(owner.dynamicCapacity + 2);
  });
});
