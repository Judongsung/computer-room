import { Component, createRef } from "react";

interface FilesystemScrollRetentionProps {
  readonly location: string;
  readonly scope?: object;
}
interface ScrollPosition {
  readonly element: HTMLElement;
  readonly top: number;
  readonly left: number;
}

// A commit snapshot captures scrolling performed while a request was pending.
// The hidden marker adds no layout and finds the existing scroll container.
export class FilesystemScrollRetention extends Component<FilesystemScrollRetentionProps, object, ScrollPosition[]> {
  private readonly marker = createRef<HTMLSpanElement>();

  getSnapshotBeforeUpdate(previous: FilesystemScrollRetentionProps): ScrollPosition[] {
    const reset = previous.location !== this.props.location ||
      previous.scope !== this.props.scope;
    const snapshot: ScrollPosition[] = [];
    let element = this.marker.current?.parentElement;
    while (element && element !== document.body) {
      const style = getComputedStyle(element);
      if (/(auto|scroll)/.test(`${style.overflow} ${style.overflowY} ${style.overflowX}`)) {
        snapshot.push({
          element,
          top: reset ? 0 : element.scrollTop,
          left: reset ? 0 : element.scrollLeft,
        });
      }
      element = element.parentElement;
    }
    return snapshot;
  }

  componentDidUpdate(
    _previous: FilesystemScrollRetentionProps,
    _state: object,
    snapshot: ScrollPosition[],
  ): void {
    for (const { element, top, left } of snapshot) {
      element.scrollTop = Math.min(top, Math.max(0, element.scrollHeight - element.clientHeight));
      element.scrollLeft = Math.min(left, Math.max(0, element.scrollWidth - element.clientWidth));
    }
  }

  render() {
    return <span hidden ref={this.marker} />;
  }
}
