import type { CSSProperties, ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@client/app";
import { CLIENT_ACCESS_MODE } from "@client/constants/platform/access";
import { CLIENT_INTERFACE_MODE } from "@client/constants/shared/interface-mode";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { GUEST_API_PATHS } from "@/constants/platform/api";
import { NOTEPAD_COPY } from "@client/content/ko/filesystem/text/notepad";
import { MOBILE_COPY } from "@client/content/ko/mobile/mobile";
import { DASHBOARD_COPY } from "@client/content/ko/widgets/content";
import { FakeFilesystemGateway } from "@test/support/filesystem/fake-filesystem-gateway";
import { FakeDashboardGateway } from "@test/support/widgets/fake-dashboard-gateway";
import { desktopWindowByTitle } from "@test/client/support/desktop/app-integration-helpers";
import type { GuestGateway } from "@client/types/guest/guest";

vi.mock("react-rnd", () => ({ Rnd: ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <div data-testid="desktop-window" style={style}>{children}</div> }));
beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, "", "/"); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function setup(guest: boolean, mobile: boolean) {
  const filesystem = new FakeFilesystemGateway();
  const text = filesystem.addFile("문서.md", "application/octet-stream", FILESYSTEM_ROOT_ID.DESKTOP);
  const binary = filesystem.addFile("archive.zip", "application/zip", FILESYSTEM_ROOT_ID.DESKTOP);
  const guestGateway: GuestGateway = {
    getSession: async () => ({ enabled: true, loginUrl: "/auth/login" }),
    listDirectory: filesystem.listDirectory.bind(filesystem),
    downloadUrl: (id) => `${GUEST_API_PATHS.FILES}/${id}/download`,
    contentUrl: filesystem.contentUrl.bind(filesystem),
    thumbnailUrl: filesystem.thumbnailUrl.bind(filesystem),
    getProgramDocument: async () => { throw new Error("Unexpected program document read"); },
  };
  const api = new FakeDashboardGateway();
  const create = vi.spyOn(api, "createWidget");
  const fetch = vi.fn().mockImplementation(async () => new Response("# 원문\n한글 😀"));
  vi.stubGlobal("fetch", fetch);
  render(<App api={api} filesystemApi={filesystem} guestApi={guestGateway}
    mobilePreferencesApi={{ getPreferences: async () => ({ wallpaper: null }), updateWallpaper: async () => ({ wallpaper: null }) }}
    accessMode={guest ? CLIENT_ACCESS_MODE.GUEST : CLIENT_ACCESS_MODE.OWNER}
    interfaceMode={mobile ? CLIENT_INTERFACE_MODE.MOBILE : CLIENT_INTERFACE_MODE.DESKTOP} />);
  return { text, binary, filesystem, guestGateway, fetch, create };
}

describe.each([
  { guest: false, mobile: false }, { guest: false, mobile: true },
  { guest: true, mobile: false }, { guest: true, mobile: true },
])("file opening (guest=$guest, mobile=$mobile)", ({ guest, mobile }) => {
  it("opens a text file read-only through the correct download API", async () => {
    const user = userEvent.setup();
    const { text, filesystem, guestGateway, fetch, create } = setup(guest, mobile);
    const shortcut = await screen.findByRole("button", { name: text.name });
    if (mobile) await user.click(shortcut); else await user.dblClick(shortcut);
    expect(await screen.findByRole("textbox", { name: NOTEPAD_COPY.TEXT_LABEL })).toHaveValue("# 원문\n한글 😀");
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    expect(fetch).toHaveBeenCalledWith((guest ? guestGateway : filesystem).downloadUrl(text.id), expect.anything());
    expect(create).not.toHaveBeenCalled();
    if (mobile) {
      expect(screen.getByRole("heading", { name: NOTEPAD_COPY.WINDOW_TITLE(text.name) })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: MOBILE_COPY.BACK }));
      expect(await screen.findByRole("button", { name: text.name })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: text.name }));
      await screen.findByRole("textbox");
      await user.click(screen.getByRole("button", { name: MOBILE_COPY.HOME }));
      expect(await screen.findByRole("button", { name: text.name })).toBeInTheDocument();
    } else {
      await user.dblClick(shortcut);
      expect(screen.getAllByRole("textbox")).toHaveLength(1);
      const window = desktopWindowByTitle(NOTEPAD_COPY.WINDOW_TITLE(text.name));
      await user.click(within(window).getByRole("button", { name: DASHBOARD_COPY.MINIMIZE }));
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: NOTEPAD_COPY.WINDOW_TITLE(text.name) }));
      await screen.findByRole("textbox");
      await user.click(within(desktopWindowByTitle(NOTEPAD_COPY.WINDOW_TITLE(text.name))).getByRole("button", { name: DASHBOARD_COPY.CLOSE }));
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: NOTEPAD_COPY.WINDOW_TITLE(text.name) })).not.toBeInTheDocument();
    }
  });

  it("waits for confirmation before downloading unsupported files", async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const { binary, fetch } = setup(guest, mobile);
    const open = async () => {
      const shortcut = await screen.findByRole("button", { name: binary.name });
      if (mobile) await user.click(shortcut); else await user.dblClick(shortcut);
      return screen.findByRole("dialog", { name: NOTEPAD_COPY.DOWNLOAD_TITLE });
    };
    let dialog = await open();
    expect(click).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: NOTEPAD_COPY.CANCEL }));
    expect(click).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    dialog = await open();
    await user.click(within(dialog).getByRole("button", { name: NOTEPAD_COPY.DOWNLOAD }));
    expect(click).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

it("uses the same opener inside a desktop folder and keeps it behind newly focused text windows", async () => {
  const user = userEvent.setup();
  const { filesystem, text } = setup(false, false);
  const second = filesystem.addFile("config.json", "application/json");
  await user.dblClick(await screen.findByRole("button", { name: "내 문서" }));
  const directory = await waitFor(() => desktopWindowByTitle("내 문서"));
  await user.dblClick(await within(directory).findByRole("button", { name: /config.json/ }));
  await screen.findByRole("textbox");
  await user.dblClick(screen.getByRole("button", { name: text.name }));
  await waitFor(() => expect(screen.getAllByRole("textbox")).toHaveLength(2));
  const firstWindow = desktopWindowByTitle(NOTEPAD_COPY.WINDOW_TITLE(text.name));
  const secondWindow = desktopWindowByTitle(NOTEPAD_COPY.WINDOW_TITLE(second.name));
  expect(Number(firstWindow.style.zIndex)).toBeGreaterThan(Number(secondWindow.style.zIndex));
  const order = Array.from(document.querySelectorAll(".taskbar__window")).map((item) => item.textContent);
  await user.click(screen.getByRole("button", { name: NOTEPAD_COPY.WINDOW_TITLE(second.name) }));
  expect(Array.from(document.querySelectorAll(".taskbar__window")).map((item) => item.textContent)).toEqual(order);
});
