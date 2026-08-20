import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/client/app";
import {
  DASHBOARD_LAYOUT,
  UI_MESSAGES,
} from "../../src/client/constants/dashboard";
import {
  BLANK_WIDGET_COPY,
  DASHBOARD_COPY,
} from "../../src/client/constants/content";
import type { DashboardGateway } from "../../src/client/types/api";
import { ACCESS_LOGOUT_PATH } from "../../src/constants/auth";
import { MAX_FILE_SIZE_BYTES } from "../../src/constants/file";
import type { SessionInfo } from "../../src/types/auth";
import type { WidgetLayout } from "../../src/types/widget";
import { cloneWidgetLayouts } from "../../src/domain/widget-layout";

vi.mock("react-grid-layout", () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="desktop-grid">{children}</div>
  ),
  useContainerWidth: () => ({
    width: DASHBOARD_LAYOUT.MAX_WIDTH_PX,
    containerRef: () => undefined,
    mounted: true,
  }),
  noCompactor: {
    type: null,
    allowOverlap: false,
    compact: (layout: unknown) => layout,
  },
}));

const SESSION: SessionInfo = {
  email: "owner@example.com",
  logoutUrl: ACCESS_LOGOUT_PATH,
  filePolicy: { maxUploadSizeBytes: MAX_FILE_SIZE_BYTES },
};

describe("App", () => {
  beforeEach(() => setDesktop(true));

  it("adds and saves a blank widget from an initially empty board", async () => {
    const api = new FakeDashboardGateway();
    const user = userEvent.setup();
    render(<App api={api} />);

    expect(await screen.findByText(SESSION.email)).toBeInTheDocument();
    expect(screen.getByText(UI_MESSAGES.EMPTY_BOARD)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.EDIT }),
    );
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.ADD_BLANK_WIDGET }),
    );
    expect(screen.getByText(BLANK_WIDGET_COPY.EMPTY_CONTENT)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.SAVE }),
    );
    await waitFor(() => expect(api.savedWidgets).toHaveLength(1));
    expect(await screen.findByText(UI_MESSAGES.SAVE_COMPLETE)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DASHBOARD_COPY.EDIT }),
    ).toBeInTheDocument();
  });

  it("discards an unsaved widget when editing is cancelled", async () => {
    const user = userEvent.setup();
    render(<App api={new FakeDashboardGateway()} />);
    await screen.findByText(SESSION.email);

    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.EDIT }),
    );
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.ADD_BLANK_WIDGET }),
    );
    await user.click(
      screen.getByRole("button", { name: DASHBOARD_COPY.CANCEL }),
    );

    expect(
      screen.queryByText(BLANK_WIDGET_COPY.EMPTY_CONTENT),
    ).not.toBeInTheDocument();
    expect(screen.getByText(UI_MESSAGES.EMPTY_BOARD)).toBeInTheDocument();
  });

  it("renders a one-column view without editing controls on a narrow screen", async () => {
    setDesktop(false);
    render(<App api={new FakeDashboardGateway()} />);

    await screen.findByText(SESSION.email);
    expect(
      screen.queryByRole("button", { name: DASHBOARD_COPY.EDIT }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(UI_MESSAGES.MOBILE_EDIT_NOTICE)).toBeInTheDocument();
  });
});

class FakeDashboardGateway implements DashboardGateway {
  savedWidgets: WidgetLayout[] = [];

  async getSession(): Promise<SessionInfo> {
    return SESSION;
  }

  async listWidgets(): Promise<WidgetLayout[]> {
    return cloneWidgetLayouts(this.savedWidgets);
  }

  async replaceWidgets(
    widgets: readonly WidgetLayout[],
  ): Promise<WidgetLayout[]> {
    this.savedWidgets = cloneWidgetLayouts(widgets);
    return cloneWidgetLayouts(this.savedWidgets);
  }
}

function setDesktop(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
