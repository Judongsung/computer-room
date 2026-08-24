import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  XP_CONTEXT_MENU_COPY,
  XP_CONTEXT_MENU_ITEM_KIND,
} from "../../src/client/constants/context-menu";
import { contextMenuCommand } from "../../src/client/domain/context-menu";
import {
  XpContextMenuProvider,
  useXpContextMenu,
} from "../../src/client/state/context-menu-context";

describe("XpContextMenuProvider", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue("붙여넣기"),
      },
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("blocks the browser menu everywhere and closes with Escape", async () => {
    render(
      <XpContextMenuProvider>
        <div data-testid="surface">surface</div>
      </XpContextMenuProvider>,
    );
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: 30,
    });

    fireEvent(screen.getByTestId("surface"), event);
    expect(event.defaultPrevented).toBe(true);
    expect(
      screen.getByRole("menuitem", { name: XP_CONTEXT_MENU_COPY.REFRESH_PAGE }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("measures and flips a custom menu inside the viewport", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getRect(this: HTMLElement) {
        if (this.getAttribute("role") === "menu") {
          return DOMRect.fromRect({ width: 224, height: 160 });
        }
        return DOMRect.fromRect({ width: 20, height: 20 });
      },
    );
    render(
      <XpContextMenuProvider>
        <ContextMenuHarness />
      </XpContextMenuProvider>,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "target" }), {
      clientX: window.innerWidth - 2,
      clientY: window.innerHeight - 2,
    });

    const menu = screen.getByRole("menu");
    await waitFor(() => {
      expect(menu).toHaveStyle({
        left: `${window.innerWidth - 224 - 4}px`,
        top: `${window.innerHeight - 160 - 4}px`,
      });
    });
  });

  it("moves focus with XP keyboard commands and executes the focused item", async () => {
    const user = userEvent.setup();
    render(
      <XpContextMenuProvider>
        <ContextMenuHarness />
      </XpContextMenuProvider>,
    );
    fireEvent.contextMenu(screen.getByRole("button", { name: "target" }));
    const first = screen.getByRole("menuitem", { name: "first" });
    const second = screen.getByRole("menuitem", { name: "second" });
    await waitFor(() => expect(first).toHaveFocus());

    await user.keyboard("{ArrowDown}{Enter}");
    expect(second).not.toBeInTheDocument();
    expect(screen.getByText("selected:second")).toBeInTheDocument();
  });

  it("dispatches Shift+F10 to the focused app surface", async () => {
    const user = userEvent.setup();
    render(
      <XpContextMenuProvider>
        <ContextMenuHarness />
      </XpContextMenuProvider>,
    );
    screen.getByRole("button", { name: "target" }).focus();

    await user.keyboard("{Shift>}{F10}{/Shift}");

    expect(screen.getByRole("menuitem", { name: "first" })).toBeInTheDocument();
  });

  it("closes on an external pointer, scroll, and resize", () => {
    render(
      <XpContextMenuProvider>
        <ContextMenuHarness />
        <div data-testid="outside" />
      </XpContextMenuProvider>,
    );
    const target = screen.getByRole("button", { name: "target" });

    fireEvent.contextMenu(target);
    fireEvent.pointerDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.contextMenu(target);
    fireEvent.scroll(document);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.contextMenu(target);
    fireEvent(window, new Event("resize"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("preserves an input selection for copy, cut, paste, and select all", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    vi.spyOn(navigator.clipboard, "readText").mockResolvedValue("붙여넣기");
    render(
      <XpContextMenuProvider>
        <input aria-label="editor" defaultValue="alpha beta" />
      </XpContextMenuProvider>,
    );
    const input = screen.getByRole("textbox", { name: "editor" }) as HTMLInputElement;
    input.setSelectionRange(0, 5);
    fireEvent.contextMenu(input);
    await user.click(screen.getByRole("menuitem", { name: XP_CONTEXT_MENU_COPY.CUT }));
    expect(writeText).toHaveBeenCalledWith("alpha");
    expect(input).toHaveValue(" beta");

    input.setSelectionRange(0, 0);
    fireEvent.contextMenu(input);
    await user.click(screen.getByRole("menuitem", { name: XP_CONTEXT_MENU_COPY.PASTE }));
    expect(input).toHaveValue("붙여넣기 beta");

    fireEvent.contextMenu(input);
    await user.click(screen.getByRole("menuitem", { name: XP_CONTEXT_MENU_COPY.SELECT_ALL }));
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("keeps native text commands ahead of a containing app surface menu", () => {
    render(
      <XpContextMenuProvider>
        <SemanticPriorityHarness />
      </XpContextMenuProvider>,
    );
    const input = screen.getByRole("textbox", { name: "nested editor" }) as HTMLInputElement;
    input.setSelectionRange(0, 5);
    fireEvent.contextMenu(input);

    expect(
      screen.getByRole("menuitem", { name: XP_CONTEXT_MENU_COPY.COPY }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "surface command" })).not.toBeInTheDocument();
  });

  it("offers link commands and copies the resolved address", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(
      <XpContextMenuProvider>
        <a href="/destination">destination</a>
      </XpContextMenuProvider>,
    );

    fireEvent.contextMenu(screen.getByRole("link", { name: "destination" }));
    expect(
      screen.getByRole("menuitem", { name: XP_CONTEXT_MENU_COPY.OPEN_NEW_WINDOW }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("menuitem", { name: XP_CONTEXT_MENU_COPY.COPY_ADDRESS }),
    );

    expect(writeText).toHaveBeenCalledWith(
      new URL("/destination", window.location.href).href,
    );
  });

  it("opens from Shift+F10 and reports clipboard denial without losing selected text", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
      new DOMException("denied", "NotAllowedError"),
    );
    render(
      <XpContextMenuProvider>
        <input aria-label="editor" defaultValue="alpha" />
      </XpContextMenuProvider>,
    );
    const input = screen.getByRole("textbox", { name: "editor" }) as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, 5);

    await user.keyboard("{Shift>}{F10}{/Shift}");
    await user.click(screen.getByRole("menuitem", { name: XP_CONTEXT_MENU_COPY.CUT }));

    expect(input).toHaveValue("alpha");
    expect(screen.getByRole("alert")).toHaveTextContent(
      XP_CONTEXT_MENU_COPY.CLIPBOARD_FAILED,
    );
  });
});

function ContextMenuHarness() {
  const contextMenu = useXpContextMenu();
  const [selected, setSelected] = useState("none");
  return (
    <>
      <button
        type="button"
        onContextMenu={(event) =>
          contextMenu.openFromEvent(event, [
            contextMenuCommand("first", "first", () => setSelected("first")),
            {
              kind: XP_CONTEXT_MENU_ITEM_KIND.SEPARATOR,
              id: "separator",
            },
            contextMenuCommand("second", "second", () => setSelected("second")),
          ])
        }
      >
        target
      </button>
      <output>selected:{selected}</output>
    </>
  );
}

function SemanticPriorityHarness() {
  const contextMenu = useXpContextMenu();
  return (
    <div
      onContextMenu={(event) =>
        contextMenu.openFromEvent(event, [
          contextMenuCommand("surface", "surface command", vi.fn()),
        ])
      }
    >
      <input aria-label="nested editor" defaultValue="alpha" />
    </div>
  );
}
