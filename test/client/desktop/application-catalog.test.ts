import { describe, expect, it } from "vitest";
import { WIDGET_TYPE_VALUES } from "@/constants/widgets/widget";
import { APPLICATION_LAUNCH_LOCATION } from "@client/constants/desktop/application";
import { DESKTOP_APPLICATION_CATALOG } from "@client/constants/desktop/application-catalog";
import { APPLICATION_NAME_BY_TYPE } from "@client/content/ko/desktop/application";

describe("desktop application catalog", () => {
  it("defines every application once in the shared launch order", () => {
    expect(DESKTOP_APPLICATION_CATALOG.map(({ type }) => type)).toEqual(
      WIDGET_TYPE_VALUES,
    );
    expect(
      new Set(DESKTOP_APPLICATION_CATALOG.map(({ type }) => type)).size,
    ).toBe(WIDGET_TYPE_VALUES.length);
  });

  it("provides one icon, label, command, and all supported launch locations", () => {
    for (const application of DESKTOP_APPLICATION_CATALOG) {
      expect(application.iconPath).toMatch(/^\/assets\//);
      expect(application.contextCommandId).not.toBe("");
      expect(APPLICATION_NAME_BY_TYPE[application.type]).not.toBe("");
      expect(application.launchLocations).toEqual(
        Object.values(APPLICATION_LAUNCH_LOCATION),
      );
    }
  });
});
