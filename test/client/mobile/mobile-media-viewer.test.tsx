import { MEDIA_VIEWER_COPY } from "@client/content/ko/media/media";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FILESYSTEM_ENTRY_KIND,
  FILESYSTEM_ROOT_ID,
} from "@/constants/filesystem/filesystem";
import { MEDIA_KIND } from "@/constants/filesystem/media";
import { DEFAULT_FILESYSTEM_DIRECTORY_SORT } from "@/constants/filesystem/sort";
import type {
  FilesystemDirectoryPage,
  FilesystemEntry,
  FilesystemFileEntry,
} from "@/types/filesystem/filesystem";
import { MobileMediaViewer } from "@client/components/mobile/media/mobile-media-viewer";
import type { FilesystemDirectoryGateway } from "@client/types/filesystem/ports/directory";
import type { FilesystemContentGateway } from "@client/types/filesystem/ports/transfer";

type MediaGateway = Pick<FilesystemDirectoryGateway, "listDirectory"> &
  Pick<FilesystemContentGateway, "downloadUrl" | "contentUrl">;

const FIRST_IMAGE = file("image-1", "첫 이미지", "image/png");
const CURRENT_IMAGE = file("image-2", "두 번째 이미지", "image/webp");
const LAST_IMAGE = file("image-3", "마지막 이미지", "image/jpeg");
const VIDEO = file("video", "영상", "video/mp4");
const TEXT_FILE = file("text", "문서", "text/plain");

describe("MobileMediaViewer", () => {
  it("swipes through every image page in directory order and stops at edges", async () => {
    const contentUrl = vi.fn((id: string) => `/content/${id}`);
    const gateway = mediaGateway(contentUrl);
    render(<ImageViewerHarness gateway={gateway} />);

    await waitFor(() => expect(gateway.listDirectory).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("heading", { name: CURRENT_IMAGE.name })).toBeInTheDocument();
    expect(contentUrl).not.toHaveBeenCalledWith(FIRST_IMAGE.id);

    swipe(screen.getByAltText(CURRENT_IMAGE.name).parentElement, 260, 120);
    expect(
      await screen.findByRole("heading", { name: LAST_IMAGE.name }),
    ).toBeInTheDocument();

    swipe(screen.getByAltText(LAST_IMAGE.name).parentElement, 260, 120);
    expect(screen.getByAltText(LAST_IMAGE.name)).toBeInTheDocument();

    swipe(screen.getByAltText(LAST_IMAGE.name).parentElement, 120, 260);
    expect(
      await screen.findByRole("heading", { name: CURRENT_IMAGE.name }),
    ).toBeInTheDocument();
    expect(contentUrl).not.toHaveBeenCalledWith(VIDEO.id);
  });

  it("ignores short, vertical, and cancelled gestures", async () => {
    const onChangeFile = vi.fn();
    const gateway = mediaGateway();
    render(
      <MobileMediaViewer
        file={CURRENT_IMAGE}
        kind={MEDIA_KIND.IMAGE}
        directoryId={FILESYSTEM_ROOT_ID.DOCUMENTS}
        filesystemRevision={0}
        gateway={gateway}
        onChangeFile={onChangeFile}
      />,
    );
    await waitFor(() => expect(gateway.listDirectory).toHaveBeenCalledTimes(2));
    const viewport = screen.getByAltText(CURRENT_IMAGE.name).parentElement;

    swipe(viewport, 200, 170);
    swipe(viewport, 200, 140, 100, 210);
    fireEvent.pointerDown(requireElement(viewport), {
      pointerId: 1,
      isPrimary: true,
      clientX: 240,
      clientY: 100,
    });
    fireEvent.pointerCancel(requireElement(viewport), { pointerId: 1 });
    fireEvent.pointerUp(requireElement(viewport), {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });

    expect(onChangeFile).not.toHaveBeenCalled();
  });

  it("releases pointer capture before changing the displayed image", async () => {
    const onChangeFile = vi.fn();
    const releasePointerCapture = vi.fn();
    const gateway = mediaGateway();
    render(
      <MobileMediaViewer
        file={CURRENT_IMAGE}
        kind={MEDIA_KIND.IMAGE}
        directoryId={FILESYSTEM_ROOT_ID.DOCUMENTS}
        filesystemRevision={0}
        gateway={gateway}
        onChangeFile={onChangeFile}
      />,
    );
    await waitFor(() => expect(gateway.listDirectory).toHaveBeenCalledTimes(2));
    const viewport = requireElement(
      screen.getByAltText(CURRENT_IMAGE.name).parentElement,
    );
    Object.defineProperties(viewport, {
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: vi.fn(() => true) },
      releasePointerCapture: { value: releasePointerCapture },
    });

    swipe(viewport, 260, 120);

    expect(releasePointerCapture).toHaveBeenCalledWith(1);
    expect(onChangeFile).toHaveBeenCalledWith(LAST_IMAGE);
    const releaseOrder = releasePointerCapture.mock.invocationCallOrder[0];
    const changeOrder = onChangeFile.mock.invocationCallOrder[0];
    if (releaseOrder === undefined || changeOrder === undefined) {
      throw new Error("Expected pointer release and image change calls.");
    }
    expect(releaseOrder).toBeLessThan(changeOrder);
  });

  it("does not load directory navigation for videos", () => {
    const gateway = mediaGateway();
    render(
      <MobileMediaViewer
        file={VIDEO}
        kind={MEDIA_KIND.VIDEO}
        directoryId={FILESYSTEM_ROOT_ID.DOCUMENTS}
        filesystemRevision={0}
        gateway={gateway}
        onChangeFile={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: VIDEO.name })).toBeInTheDocument();
    expect(gateway.listDirectory).not.toHaveBeenCalled();
  });

  it("shows a directory navigation error without hiding the current image", async () => {
    const gateway = {
      ...mediaGateway(),
      listDirectory: vi.fn(async () => {
        throw new Error(MEDIA_VIEWER_COPY.NAVIGATION_FAILED);
      }),
    } satisfies MediaGateway;
    render(
      <MobileMediaViewer
        file={CURRENT_IMAGE}
        kind={MEDIA_KIND.IMAGE}
        directoryId={FILESYSTEM_ROOT_ID.DOCUMENTS}
        filesystemRevision={0}
        gateway={gateway}
        onChangeFile={vi.fn()}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MEDIA_VIEWER_COPY.NAVIGATION_FAILED,
    );
    expect(screen.getByAltText(CURRENT_IMAGE.name)).toBeInTheDocument();
  });
});

function ImageViewerHarness({ gateway }: { readonly gateway: MediaGateway }) {
  const [current, setCurrent] = useState(CURRENT_IMAGE);
  return (
    <MobileMediaViewer
      file={current}
      kind={MEDIA_KIND.IMAGE}
      directoryId={FILESYSTEM_ROOT_ID.DOCUMENTS}
      filesystemRevision={0}
      gateway={gateway}
      onChangeFile={setCurrent}
    />
  );
}

function mediaGateway(
  contentUrl = vi.fn((id: string) => `/content/${id}`),
): MediaGateway {
  return {
    listDirectory: vi.fn(async (_parentId?: string, offset = 0) =>
      offset === 0
        ? directoryPage(
            [FIRST_IMAGE, VIDEO, TEXT_FILE, CURRENT_IMAGE],
            100,
          )
        : directoryPage([LAST_IMAGE], null),
    ),
    contentUrl,
    downloadUrl: (id: string) => `/download/${id}`,
  };
}

function directoryPage(
  items: readonly FilesystemEntry[],
  nextOffset: number | null,
): FilesystemDirectoryPage {
  return {
    directory: {
      id: FILESYSTEM_ROOT_ID.DOCUMENTS,
      parentId: null,
      kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
      name: "내 문서",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      desktopOrder: null,
    },
    breadcrumbs: [{ id: FILESYSTEM_ROOT_ID.DOCUMENTS, name: "내 문서" }],
    items,
    nextOffset,
    sort: DEFAULT_FILESYSTEM_DIRECTORY_SORT,
  };
}

function file(
  id: string,
  name: string,
  contentType: string,
): FilesystemFileEntry {
  return {
    id,
    parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
    kind: FILESYSTEM_ENTRY_KIND.FILE,
    name,
    contentType,
    size: 10,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    desktopOrder: null,
  };
}

function swipe(
  element: Element | null,
  startX: number,
  endX: number,
  startY = 100,
  endY = 100,
): void {
  const target = requireElement(element);
  fireEvent.pointerDown(target, {
    pointerId: 1,
    isPrimary: true,
    clientX: startX,
    clientY: startY,
  });
  fireEvent.pointerUp(target, {
    pointerId: 1,
    clientX: endX,
    clientY: endY,
  });
}

function requireElement(element: Element | null): Element {
  if (!element) throw new Error("Expected media viewport element.");
  return element;
}
