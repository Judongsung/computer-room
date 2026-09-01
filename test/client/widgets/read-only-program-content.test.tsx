import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import { ReadOnlyProgramContent } from "@client/components/widgets/read-only-program-content";
import { CHECKLIST_WIDGET_COPY } from "@client/content/ko/widgets/content";

describe("read-only program content", () => {
  it("renders memo markdown without edit controls", () => {
    render(
      <ReadOnlyProgramContent
        program={{
          type: WIDGET_TYPE.MEMO,
          data: { markdown: "# 공개 메모", updatedAt: null },
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "공개 메모" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders checklist state through read-only checkboxes", () => {
    render(
      <ReadOnlyProgramContent
        program={{
          type: WIDGET_TYPE.DAILY_CHECKLIST,
          data: {
            businessDate: "2026-09-01",
            nextResetAt: "2026-09-02T00:00:00.000+09:00",
            items: [
              { id: "done", label: "완료 항목", checked: true },
              { id: "todo", label: "남은 항목", checked: false },
            ],
          },
        }}
      />,
    );

    expect(
      screen.getByText(CHECKLIST_WIDGET_COPY.DATE("2026-09-01")),
    ).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes.every((checkbox) => (checkbox as HTMLInputElement).readOnly)).toBe(true);
  });
});
