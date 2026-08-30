import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { XpTabs } from "@client/components/shared/xp-tabs";

describe("XpTabs", () => {
  it("renders data-defined panels and supports reusable keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);

    const first = screen.getByRole("tab", { name: "First" });
    const third = screen.getByRole("tab", { name: "Third" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("First panel");

    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(third).toHaveFocus();
    expect(third).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Third panel");

    await user.keyboard("{Home}");
    expect(first).toHaveFocus();
    await user.keyboard("{End}");
    expect(third).toHaveFocus();
  });
});

function TabsHarness() {
  const [active, setActive] = useState<"first" | "second" | "third">("first");
  return (
    <XpTabs
      ariaLabel="Reusable tabs"
      activeTab={active}
      onChange={setActive}
      tabs={[
        { id: "first", label: "First", panel: <p>First panel</p> },
        {
          id: "second",
          label: "Second",
          panel: <p>Second panel</p>,
          disabled: true,
        },
        { id: "third", label: "Third", panel: <p>Third panel</p> },
      ]}
    />
  );
}
