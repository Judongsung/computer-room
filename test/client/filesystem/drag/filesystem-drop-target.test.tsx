import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FILESYSTEM_DROP_ATTRIBUTE } from "@client/constants/filesystem/drag";
import { FILESYSTEM_DRAG_SOURCE } from "@client/constants/filesystem/filesystem";
import { useFilesystemDropTarget } from "@client/hooks/filesystem/drag/use-filesystem-drop-target";
import { dragTransfer } from "@test/support/filesystem/drag-transfer";

function Targets({ onDrop = vi.fn(), disabled = false, allowLocalFiles = true }) {
  const targets = useFilesystemDropTarget();
  return (
    <div data-testid="directory" {...targets.getProps("directory", () => onDrop("directory"))}>
      <button {...targets.getProps("first", () => onDrop("first"), { disabled, allowLocalFiles })}>
        <img alt="first icon" />{" "}<span>First</span>
      </button>
      <button {...targets.getProps("second", () => onDrop("second"))}>Second</button>
      <div data-testid="window" {...{ [FILESYSTEM_DROP_ATTRIBUTE.BOUNDARY]: true }}>Window</div>
    </div>
  );
}

function internalDrag() {
  return dragTransfer({ ids: ["file"], primaryId: "file", source: FILESYSTEM_DRAG_SOURCE.ACTIVE });
}

function transition(type: "dragenter" | "dragleave", target: Element, relatedTarget: EventTarget, dataTransfer: DataTransfer) {
  // jsdom has no DragEvent constructor; preserve the native MouseEvent fields explicitly.
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, relatedTarget });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  fireEvent(target, event);
}

describe("filesystem drop boundaries", () => {
  it("keeps the whole item highlighted across child transitions and ignores a previous target's leave", () => {
    render(<Targets />);
    const dataTransfer = internalDrag();
    const first = screen.getByRole("button", { name: "first icon First" });
    const second = screen.getByRole("button", { name: "Second" });
    const icon = screen.getByAltText("first icon");
    const label = screen.getByText("First");

    fireEvent.dragEnter(first, { dataTransfer });
    transition("dragenter", icon, first, dataTransfer);
    transition("dragleave", first, icon, dataTransfer);
    expect(first).toHaveAttribute("data-drop-target", "true");
    transition("dragenter", label, icon, dataTransfer);
    transition("dragleave", icon, label, dataTransfer);
    expect(first).toHaveAttribute("data-drop-target", "true");

    transition("dragenter", second, label, dataTransfer);
    transition("dragleave", label, second, dataTransfer);
    expect(first).toHaveAttribute("data-drop-target", "false");
    expect(second).toHaveAttribute("data-drop-target", "true");
    expect(dataTransfer.getData).not.toHaveBeenCalled();
    transition("dragleave", second, document.body, dataTransfer);
    expect(second).toHaveAttribute("data-drop-target", "false");
  });

  it.each(["button", "icon", "name"])("drops on the %s only once and never on its parent", (part) => {
    const onDrop = vi.fn();
    render(<Targets onDrop={onDrop} />);
    const first = screen.getByRole("button", { name: "first icon First" });
    const surface = { button: first, icon: screen.getByAltText("first icon"), name: screen.getByText("First") }[part]!;
    const dataTransfer = internalDrag();
    fireEvent.dragOver(surface, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("move");
    fireEvent.drop(surface, { dataTransfer });
    expect(onDrop).toHaveBeenCalledExactlyOnceWith("first");
    expect(first).toHaveAttribute("data-drop-target", "false");
  });

  it("clears nested ownership and cancellation without falling through a window boundary", () => {
    const onDrop = vi.fn();
    render(<Targets onDrop={onDrop} />);
    const dataTransfer = internalDrag();
    const directory = screen.getByTestId("directory");
    const first = screen.getByRole("button", { name: "first icon First" });
    fireEvent.dragEnter(directory, { dataTransfer });
    fireEvent.dragEnter(first, { dataTransfer });
    transition("dragleave", directory, first, dataTransfer);
    expect(directory).toHaveAttribute("data-drop-target", "false");
    expect(first).toHaveAttribute("data-drop-target", "true");
    fireEvent.dragEnd(document, { dataTransfer });
    expect(first).toHaveAttribute("data-drop-target", "false");
    fireEvent.drop(screen.getByTestId("window"), { dataTransfer });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("uses copy for local files and rejects text, local files at trash targets, and busy targets", () => {
    const onDrop = vi.fn();
    const { rerender } = render(<Targets onDrop={onDrop} />);
    const first = screen.getByRole("button", { name: "first icon First" });
    const files = dragTransfer(undefined, [new File(["data"], "file.txt")]);
    fireEvent.dragOver(first, { dataTransfer: files });
    expect(files.dropEffect).toBe("copy");
    rerender(<Targets onDrop={onDrop} allowLocalFiles={false} />);
    fireEvent.dragOver(first, { dataTransfer: files });
    expect(files.dropEffect).toBe("none");
    fireEvent.drop(first, { dataTransfer: files });
    rerender(<Targets onDrop={onDrop} disabled />);
    fireEvent.drop(first, { dataTransfer: internalDrag() });
    const text = dragTransfer();
    text.setData("text/plain", "text");
    expect(fireEvent.drop(first, { dataTransfer: text })).toBe(true);
    expect(onDrop).not.toHaveBeenCalled();
  });
});
