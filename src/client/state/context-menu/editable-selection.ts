export interface PreservedEditableTarget {
  readonly element: HTMLInputElement | HTMLTextAreaElement | HTMLElement;
  readonly selectionStart: number | null;
  readonly selectionEnd: number | null;
  readonly range: Range | null;
}

export function preserveEditableTarget(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
): PreservedEditableTarget {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return {
      element,
      selectionStart: element.selectionStart,
      selectionEnd: element.selectionEnd,
      range: null,
    };
  }
  const selection = window.getSelection();
  return {
    element,
    selectionStart: null,
    selectionEnd: null,
    range: selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null,
  };
}

export function canModifyEditable(target: PreservedEditableTarget): boolean {
  const { element } = target;
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return !element.disabled && !element.readOnly;
  }
  return element.isContentEditable;
}

export function editableSelectionText(
  target: PreservedEditableTarget,
): string {
  const { element, selectionStart, selectionEnd } = target;
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return selectionStart === null || selectionEnd === null
      ? ""
      : element.value.slice(selectionStart, selectionEnd);
  }
  return target.range?.toString() ?? "";
}

export function replaceEditableSelection(
  target: PreservedEditableTarget,
  value: string,
): void {
  const { element, selectionStart, selectionEnd } = target;
  element.focus();
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const start = selectionStart ?? element.value.length;
    const end = selectionEnd ?? start;
    element.setRangeText(value, start, end, "end");
    dispatchEditableInput(element, value);
    return;
  }
  const selection = window.getSelection();
  const range = target.range;
  if (!selection || !range) return;
  selection.removeAllRanges();
  selection.addRange(range);
  range.deleteContents();
  const node = document.createTextNode(value);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  dispatchEditableInput(element, value);
}

export function selectAllEditable(target: PreservedEditableTarget): void {
  const { element } = target;
  element.focus();
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    element.select();
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function selectAllDocumentText(): void {
  const range = document.createRange();
  range.selectNodeContents(document.body);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function dispatchEditableInput(element: HTMLElement, value: string): void {
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value,
    }),
  );
}
