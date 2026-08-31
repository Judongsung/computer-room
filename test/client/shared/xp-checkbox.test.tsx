import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { XpCheckbox } from "@client/components/shared/xp-checkbox";

describe("XpCheckbox", () => {
  it("renders the XP.css input and label as adjacent siblings", async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(
      <XpCheckbox
        checked={false}
        label="게스트 접속 허용"
        onCheckedChange={onCheckedChange}
      />,
    );

    const input = screen.getByRole("checkbox", {
      name: "게스트 접속 허용",
    });
    const label = screen.getByText("게스트 접속 허용").closest("label");
    expect(input.nextElementSibling).toBe(label);

    await user.click(label!);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("exposes an indeterminate checkbox with a hidden visible label", () => {
    render(
      <XpCheckbox
        checked={false}
        indeterminate
        label="사진 부분 공개"
        labelVisuallyHidden
        onCheckedChange={vi.fn()}
      />,
    );

    const input = screen.getByRole("checkbox", { name: "사진 부분 공개" });
    expect(input).toBePartiallyChecked();
    expect(input).toHaveAttribute("aria-checked", "mixed");
    expect(input.nextElementSibling).toHaveAttribute("for", input.id);
  });
});
