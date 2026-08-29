import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { WIDGET_TYPE } from "@/constants/widgets/widget";
import type {
  ChecklistItem,
  DailyChecklistData,
  DailyChecklistWidget as DailyChecklistWidgetData,
  DashboardWidget,
} from "@/types/widgets/widget";
import { DailyChecklistWidget } from "@client/components/widgets/daily-checklist-widget";
import { CHECKLIST_WIDGET_COPY } from "@client/content/ko/widgets/content";
import type { ImageUploadProfileGateway } from "@client/types/integrations/image-upload-profile";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import type { DashboardGateway } from "@client/types/widgets/api";
import type { WidgetWindowControls } from "@client/types/desktop/desktop";
import { checklistWidget } from "@test/client/support/desktop/app-integration-helpers";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";

describe("DailyChecklistWidget", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rolls back an optimistic check when the mutation fails", async () => {
    const item = { id: "item", label: "물 마시기", checked: false } as const;
    const widget = widgetWithData({ items: [item] });
    const gateway = new FakeDashboardGateway();
    const pending = deferred<ChecklistItem>();
    gateway.setChecklistItemChecked = vi.fn(() => pending.promise);
    const user = userEvent.setup();
    render(<ChecklistHarness widget={widget} gateway={gateway} />);

    const checkbox = screen.getByRole("checkbox", { name: item.label });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await act(async () => pending.reject(new Error("toggle failed")));

    expect(await screen.findByRole("alert")).toHaveTextContent("toggle failed");
    expect(checkbox).not.toBeChecked();
  });

  it("refreshes checklist data when the page regains focus", async () => {
    const item = { id: "focused", label: "다시 불러온 항목", checked: false } as const;
    const widget = widgetWithData({ items: [] });
    const gateway = new FakeDashboardGateway();
    gateway.getChecklist = vi.fn(async () => ({
      ...widget.data,
      items: [item],
    }));
    render(<ChecklistHarness widget={widget} gateway={gateway} />);

    act(() => window.dispatchEvent(new Event("focus")));

    expect(
      await screen.findByRole("checkbox", { name: item.label }),
    ).toBeInTheDocument();
    expect(gateway.getChecklist).toHaveBeenCalledWith(widget.id);
  });

  it("refreshes after the configured reset time", async () => {
    vi.useFakeTimers();
    const now = Date.UTC(2026, 7, 20, 14, 59, 50);
    vi.setSystemTime(now);
    const widget = widgetWithData({
      items: [],
      nextResetAt: new Date(now + 5_000).toISOString(),
    });
    const gateway = new FakeDashboardGateway();
    gateway.getChecklist = vi.fn(async () => widget.data);
    render(<ChecklistHarness widget={widget} gateway={gateway} />);

    await act(async () => vi.advanceTimersByTimeAsync(6_000));

    expect(gateway.getChecklist).toHaveBeenCalledWith(widget.id);
  });
});

function ChecklistHarness({
  widget: initialWidget,
  gateway,
}: {
  readonly widget: DailyChecklistWidgetData;
  readonly gateway: DashboardGateway;
}) {
  const [widget, setWidget] = useState(initialWidget);
  const updateWidget = (next: DashboardWidget): void => {
    if (next.type === WIDGET_TYPE.DAILY_CHECKLIST) setWidget(next);
  };
  return (
    <DailyChecklistWidget
      widget={widget}
      gateway={gateway}
      storageStatusGateway={STORAGE_STATUS_GATEWAY}
      imageUploadProfileGateway={IMAGE_UPLOAD_PROFILE_GATEWAY}
      windowControls={WINDOW_CONTROLS}
      onWidgetChange={updateWidget}
    />
  );
}

function widgetWithData(
  data: Partial<DailyChecklistData>,
): DailyChecklistWidgetData {
  const widget = checklistWidget("checklist", 0);
  if (widget.type !== WIDGET_TYPE.DAILY_CHECKLIST) {
    throw new Error("Expected checklist fixture.");
  }
  return {
    ...widget,
    data: {
      ...widget.data,
      nextResetAt: "2099-01-01T00:00:00.000Z",
      ...data,
    },
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly reject: (reason: unknown) => void;
} {
  let reject = (_reason: unknown): void => undefined;
  const promise = new Promise<T>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

const WINDOW_CONTROLS: WidgetWindowControls = {
  isActive: true,
  isMaximized: false,
  onFocus: vi.fn(),
  onMinimize: vi.fn(),
  onToggleMaximize: vi.fn(),
  onClose: vi.fn(),
  onSaveFile: vi.fn(),
  canSaveFile: false,
};

const STORAGE_STATUS_GATEWAY: StorageStatusGateway = {
  getStatus: async () => {
    throw new Error("Unexpected storage status request.");
  },
};

const IMAGE_UPLOAD_PROFILE_GATEWAY: ImageUploadProfileGateway = {
  listProfiles: async () => [],
  createProfile: async () => {
    throw new Error("Unexpected profile creation.");
  },
  updateProfile: async () => {
    throw new Error("Unexpected profile update.");
  },
  deleteProfile: async () => {
    throw new Error("Unexpected profile deletion.");
  },
};
