import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilesystemScrollRetention } from "@client/components/filesystem/filesystem-scroll-retention";

describe("filesystem scroll retention", () => {
  it("captures the latest position, clamps shortened content and resets on navigation", () => {
    const view = (location: string, text: string) => (
      <div style={{ overflow: "auto" }} data-testid="scroll">
        <FilesystemScrollRetention location={location} />
        <p>{text}</p>
      </div>
    );
    const { getByTestId, rerender } = render(view("folder", "old"));
    const element = getByTestId("scroll");
    Object.defineProperties(element, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { value: 100 },
    });
    element.scrollTop = 350;
    rerender(view("folder", "refreshed"));
    expect(element.scrollTop).toBe(350);
    Object.defineProperty(element, "scrollHeight", { value: 200 });
    rerender(view("folder", "shorter"));
    expect(element.scrollTop).toBe(100);
    rerender(view("other-folder", "new"));
    expect(element.scrollTop).toBe(0);
  });
});
