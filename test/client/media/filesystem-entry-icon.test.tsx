import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilesystemEntryIcon } from "@client/components/filesystem/filesystem-entry-icon";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { ThumbnailLoadCoordinator } from "@client/domain/filesystem/thumbnail-load-coordinator";
import { ThumbnailLoadProvider } from "@client/state/filesystem/thumbnail-load-context";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { THUMBNAIL_SPEC } from "@/constants/filesystem/thumbnail";
import type { FilesystemFileEntry } from "@/types/filesystem/filesystem";

const IMAGE_ENTRY: FilesystemFileEntry = {
  id: "image-id",
  parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
  kind: FILESYSTEM_ENTRY_KIND.FILE,
  name: "image.png",
  contentType: "image/png",
  size: 100,
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:00:00.000Z",
  desktopOrder: null,
};

describe("FilesystemEntryIcon", () => {
  afterEach(() => {
    TestIntersectionObserver.instances = [];
    vi.unstubAllGlobals();
  });

  it("requests a thumbnail only after the image enters the visible area", async () => {
    installIntersectionObserver();
    const thumbnailUrl = vi.fn((id: string) => `/api/files/${id}/thumbnail`);
    const { container } = render(
      <ThumbnailLoadProvider coordinator={new ThumbnailLoadCoordinator(4)}>
        <FilesystemEntryIcon entry={IMAGE_ENTRY} thumbnailUrl={thumbnailUrl} />
      </ThumbnailLoadProvider>,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      DESKTOP_ASSET_PATHS.FILE_ICON,
    );
    expect(thumbnailUrl).not.toHaveBeenCalled();

    act(() => TestIntersectionObserver.instances[0]?.trigger(true));
    await waitFor(() => expect(thumbnailUrl).toHaveBeenCalledWith(IMAGE_ENTRY.id));
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/api/files/image-id/thumbnail");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).toHaveClass("filesystem-entry-icon--thumbnail-loading");
    expect(thumbnailUrl).toHaveBeenCalledWith(IMAGE_ENTRY.id);

    fireEvent.load(image!);
    expect(container.querySelector("img")).not.toHaveClass(
      "filesystem-entry-icon--thumbnail-loading",
    );
    expect(
      container
        .querySelector("img")
        ?.style.getPropertyValue("--filesystem-entry-fallback-icon"),
    ).toBe("");

    fireEvent.error(container.querySelector("img")!);

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      DESKTOP_ASSET_PATHS.FILE_ICON,
    );
  });

  it("uses the generic icon without a request for unsupported or oversized images", () => {
    const thumbnailUrl = vi.fn((id: string) => `/api/files/${id}/thumbnail`);
    const { container, rerender } = render(
      <ThumbnailLoadProvider coordinator={new ThumbnailLoadCoordinator(4)}>
        <FilesystemEntryIcon
          entry={{ ...IMAGE_ENTRY, contentType: "image/bmp" }}
          thumbnailUrl={thumbnailUrl}
        />
      </ThumbnailLoadProvider>,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      DESKTOP_ASSET_PATHS.FILE_ICON,
    );

    rerender(
      <ThumbnailLoadProvider coordinator={new ThumbnailLoadCoordinator(4)}>
        <FilesystemEntryIcon
          entry={{
            ...IMAGE_ENTRY,
            contentType: "image/png",
            size: THUMBNAIL_SPEC.MAX_SOURCE_SIZE_BYTES + 1,
          }}
          thumbnailUrl={thumbnailUrl}
        />
      </ThumbnailLoadProvider>,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      DESKTOP_ASSET_PATHS.FILE_ICON,
    );
    expect(thumbnailUrl).not.toHaveBeenCalled();
  });

  it("cancels a queued thumbnail when its item is removed", async () => {
    installIntersectionObserver();
    const coordinator = new ThumbnailLoadCoordinator(1);
    const secondEntry = { ...IMAGE_ENTRY, id: "image-2", name: "image-2.png" };
    const thirdEntry = { ...IMAGE_ENTRY, id: "image-3", name: "image-3.png" };
    const thumbnailUrl = vi.fn((id: string) => `/api/files/${id}/thumbnail`);
    const { container, rerender } = render(
      <ThumbnailLoadProvider coordinator={coordinator}>
        <FilesystemEntryIcon
          key={IMAGE_ENTRY.id}
          entry={IMAGE_ENTRY}
          thumbnailUrl={thumbnailUrl}
        />
        <FilesystemEntryIcon
          key={secondEntry.id}
          entry={secondEntry}
          thumbnailUrl={thumbnailUrl}
        />
      </ThumbnailLoadProvider>,
    );
    act(() => {
      TestIntersectionObserver.instances.forEach((observer) =>
        observer.trigger(true),
      );
    });
    await waitFor(() =>
      expect(thumbnailUrl).toHaveBeenCalledWith(IMAGE_ENTRY.id),
    );
    expect(thumbnailUrl).not.toHaveBeenCalledWith(secondEntry.id);

    rerender(
      <ThumbnailLoadProvider coordinator={coordinator}>
        <FilesystemEntryIcon
          key={IMAGE_ENTRY.id}
          entry={IMAGE_ENTRY}
          thumbnailUrl={thumbnailUrl}
        />
        <FilesystemEntryIcon
          key={thirdEntry.id}
          entry={thirdEntry}
          thumbnailUrl={thumbnailUrl}
        />
      </ThumbnailLoadProvider>,
    );
    act(() => TestIntersectionObserver.instances.at(-1)?.trigger(true));
    const activeImage = [...container.querySelectorAll("img")].find(
      (image) =>
        image.getAttribute("src") === `/api/files/${IMAGE_ENTRY.id}/thumbnail`,
    );
    fireEvent.load(activeImage!);

    await waitFor(() =>
      expect(thumbnailUrl).toHaveBeenCalledWith(thirdEntry.id),
    );
    expect(thumbnailUrl).not.toHaveBeenCalledWith(secondEntry.id);
  });
});

class TestIntersectionObserver implements IntersectionObserver {
  static instances: TestIntersectionObserver[] = [];

  readonly root: Element | Document | null = null;
  readonly rootMargin: string;
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  private readonly targets = new Set<Element>();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.rootMargin = options?.rootMargin ?? "0px";
    TestIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger(isIntersecting: boolean): void {
    const entries = [...this.targets].map((target) => {
      const bounds = target.getBoundingClientRect();
      return {
        boundingClientRect: bounds,
        intersectionRatio: isIntersecting ? 1 : 0,
        intersectionRect: bounds,
        isIntersecting,
        rootBounds: null,
        target,
        time: 0,
      } satisfies IntersectionObserverEntry;
    });
    this.callback(entries, this);
  }
}

function installIntersectionObserver(): void {
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
}
