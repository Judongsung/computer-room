import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilesystemEntryIcon } from "../../src/client/components/filesystem/filesystem-entry-icon";
import { DESKTOP_ASSET_PATHS } from "../../src/client/constants/desktop";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "../../src/constants/filesystem";
import { THUMBNAIL_SPEC } from "../../src/constants/thumbnail";
import type { FilesystemFileEntry } from "../../src/types/filesystem";

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
  it("requests an eligible image thumbnail and falls back after an error", () => {
    const thumbnailUrl = vi.fn((id: string) => `/api/files/${id}/thumbnail`);
    const { container } = render(
      <FilesystemEntryIcon entry={IMAGE_ENTRY} thumbnailUrl={thumbnailUrl} />,
    );
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/api/files/image-id/thumbnail");
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
      <FilesystemEntryIcon
        entry={{ ...IMAGE_ENTRY, contentType: "image/bmp" }}
        thumbnailUrl={thumbnailUrl}
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      DESKTOP_ASSET_PATHS.FILE_ICON,
    );

    rerender(
      <FilesystemEntryIcon
        entry={{
          ...IMAGE_ENTRY,
          contentType: "image/png",
          size: THUMBNAIL_SPEC.MAX_SOURCE_SIZE_BYTES + 1,
        }}
        thumbnailUrl={thumbnailUrl}
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      DESKTOP_ASSET_PATHS.FILE_ICON,
    );
    expect(thumbnailUrl).not.toHaveBeenCalled();
  });
});
