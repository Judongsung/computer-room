import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChecklistRetentionSettings } from "@client/components/desktop/checklist/checklist-retention-settings";
import { MobileChecklistRetentionSettings } from "@client/components/mobile/widgets/mobile-checklist-retention-settings";
import { CHECKLIST_RETENTION_COPY as COPY } from "@client/content/ko/widgets/checklist-retention";
import { CHECKLIST_SETTINGS_API_PATH } from "@/constants/platform/api";

afterEach(() => vi.unstubAllGlobals());

describe.each([ChecklistRetentionSettings, MobileChecklistRetentionSettings])("retention settings %s", (Component) => {
  it("loads on demand, saves a period, and restores unlimited retention", async () => {
    const fetcher = vi.fn(async (_path: string, options?: RequestInit) => {
      const retentionDays = options?.body ? JSON.parse(String(options.body)).retentionDays : null;
      return Response.json({ settings: { retentionDays } });
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<Component />);
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: COPY.OPEN }));
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByText(COPY.WARNING)).toBeVisible();
    await user.click(screen.getByRole("checkbox"));
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "90");
    await user.click(screen.getByRole("button", { name: COPY.SAVE }));
    expect(await screen.findByText(COPY.SAVED)).toBeVisible();
    expect(fetcher).toHaveBeenLastCalledWith(CHECKLIST_SETTINGS_API_PATH,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ retentionDays: 90 }) }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: COPY.SAVE }));
    await waitFor(() => expect(fetcher).toHaveBeenLastCalledWith(CHECKLIST_SETTINGS_API_PATH,
      expect.objectContaining({ body: JSON.stringify({ retentionDays: null }) })));
  });

  it("shows a load failure without allowing an unknown setting to be overwritten", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("load failed")));
    const user = userEvent.setup();
    render(<Component />);
    await user.click(screen.getByRole("button", { name: COPY.OPEN }));
    expect(await screen.findByRole("alert")).toHaveTextContent("load failed");
    expect(screen.getByRole("button", { name: COPY.SAVE })).toBeDisabled();
  });
});
