import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { XP_EXPLORER_HEADER_COPY } from "@client/content/ko/filesystem/explorer-header";
import {
  XP_EXPLORER_HEADER_CLASS_NAME,
  XP_EXPLORER_HEADER_LAYOUT,
  XP_EXPLORER_TOOLBAR_ACTION,
} from "@client/constants/filesystem/explorer-header";
import { XpExplorerHeader } from "@client/components/filesystem/header/xp-explorer-header";
import { XpExplorerAddressBar } from "@client/components/filesystem/header/xp-explorer-address-bar";
import {
  contextMenuCommand,
  contextMenuRadioCommand,
} from "@client/domain/context-menu/context-menu";
import { XpContextMenuProvider } from "@client/state/context-menu/context-menu-context";

describe("XpExplorerHeader", () => {
  it("renders the reusable address bar with standalone XP sizing", () => {
    render(
      <XpExplorerAddressBar
        locationIconPath="/assets/windows-xp/folder.png"
        address={<span>바탕 화면{"\\"}사진</span>}
      />,
    );

    const addressBar = screen.getByLabelText(
      XP_EXPLORER_HEADER_COPY.ADDRESS_BAR,
    );
    expect(addressBar).toHaveTextContent("바탕 화면\\사진");
    expect(addressBar).toHaveStyle(
      `--xp-explorer-address-bar-height: ${XP_EXPLORER_HEADER_LAYOUT.ADDRESS_BAR_HEIGHT_PX}px`,
    );
    expect(
      addressBar.querySelector(
        `.${XP_EXPLORER_HEADER_CLASS_NAME.ADDRESS_FIELD}`,
      ),
    ).toBeInTheDocument();
  });

  it("renders the three XP header rows and preserves toolbar disabled state", () => {
    renderHeader();

    expect(
      screen.getByRole("menubar", { name: XP_EXPLORER_HEADER_COPY.MENU_BAR }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("toolbar", { name: XP_EXPLORER_HEADER_COPY.COMMAND_BAR }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(XP_EXPLORER_HEADER_COPY.ADDRESS_BAR),
    ).toHaveTextContent("내 문서\\사진");
    expect(screen.getByRole("button", { name: "다운로드" })).toBeDisabled();
  });

  it("anchors menus, switches them with pointer and arrow keys, and restores focus", async () => {
    const user = userEvent.setup();
    renderHeader();
    const menuBar = screen.getByRole("menubar");
    const fileTrigger = within(menuBar).getByRole("menuitem", { name: "파일(F)" });
    const viewTrigger = within(menuBar).getByRole("menuitem", { name: "보기(V)" });

    await user.click(fileTrigger);
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "열기" })).toHaveFocus());
    expect(fileTrigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerEnter(viewTrigger);
    expect(screen.getByRole("menuitem", { name: "새로 고침" })).toBeInTheDocument();
    await user.click(viewTrigger);
    const refreshCommand = screen.getByRole("menuitem", { name: "새로 고침" });
    const sortCommand = screen.getByRole("menuitemradio", { name: "이름" });
    expect(sortCommand).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(refreshCommand).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(sortCommand).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(refreshCommand).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "열기" })).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(fileTrigger).toHaveFocus();
  });

  it("executes an enabled popup command and closes the menu", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    renderHeader(onOpen);

    await user.click(
      within(screen.getByRole("menubar")).getByRole("menuitem", {
        name: "파일(F)",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "열기" }));

    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

function renderHeader(onOpen = vi.fn()): void {
  render(
    <XpContextMenuProvider>
      <XpExplorerHeader
        menus={[
          {
            id: "file",
            label: "파일(F)",
            accessKey: "f",
            items: [contextMenuCommand("open", "열기", onOpen)],
          },
          {
            id: "view",
            label: "보기(V)",
            accessKey: "v",
            items: [
              contextMenuCommand("refresh", "새로 고침", vi.fn()),
              contextMenuRadioCommand("name", "이름", vi.fn(), true),
            ],
          },
        ]}
        toolbarItems={[
          {
            action: XP_EXPLORER_TOOLBAR_ACTION.DOWNLOAD,
            label: "다운로드",
            disabled: true,
            onSelect: vi.fn(),
          },
        ]}
        locationIconPath="/assets/windows-xp/folder.png"
        address={<span>내 문서{"\\"}사진</span>}
      />
    </XpContextMenuProvider>,
  );
}
