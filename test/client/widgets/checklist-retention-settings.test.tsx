import { fakeChecklistRetentionGateway } from "@test/support/widgets/checklist-retention-gateway";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChecklistRetentionSettings } from "@client/components/desktop/checklist/checklist-retention-settings";
import { MobileChecklistRetentionSettings } from "@client/components/mobile/widgets/mobile-checklist-retention-settings";
import { CHECKLIST_RETENTION_COPY as COPY } from "@client/content/ko/widgets/checklist-retention";

describe.each([ChecklistRetentionSettings, MobileChecklistRetentionSettings])("retention settings %s", (Component) => {
  it("loads on demand, saves a period, and restores unlimited retention", async () => {
    const gateway = fakeChecklistRetentionGateway();
    const user = userEvent.setup();
    render(<Component gateway={gateway} />);
    expect(gateway.getSettings).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: COPY.OPEN }));
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByText(COPY.WARNING)).toBeVisible();
    await user.click(screen.getByRole("checkbox"));
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "90");
    await user.click(screen.getByRole("button", { name: COPY.SAVE }));
    expect(await screen.findByText(COPY.SAVED)).toBeVisible();
    expect(gateway.updateRetentionDays).toHaveBeenLastCalledWith(90);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: COPY.SAVE }));
    await waitFor(() => expect(gateway.updateRetentionDays).toHaveBeenLastCalledWith(null));
  });

  it("shows a load failure without allowing an unknown setting to be overwritten", async () => {
    const gateway = fakeChecklistRetentionGateway();
    gateway.getSettings.mockRejectedValue(new Error("load failed"));
    const user = userEvent.setup();
    render(<Component gateway={gateway} />);
    await user.click(screen.getByRole("button", { name: COPY.OPEN }));
    expect(await screen.findByRole("alert")).toHaveTextContent("load failed");
    expect(screen.getByRole("button", { name: COPY.SAVE })).toBeDisabled();
  });
});
