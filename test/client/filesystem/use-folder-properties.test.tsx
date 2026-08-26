import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import type { FilesystemDirectoryDetails } from "@/types/filesystem/directory-details";
import { FOLDER_PROPERTIES_STATUS } from "@client/constants/filesystem/details";
import { useFolderProperties } from "@client/hooks/filesystem/use-folder-properties";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";

const DETAILS: FilesystemDirectoryDetails = {
  directory: {
    id: "folder",
    parentId: "system-documents-root",
    kind: FILESYSTEM_ENTRY_KIND.DIRECTORY,
    name: "사진",
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T01:00:00.000Z",
    desktopOrder: null,
  },
  breadcrumbs: [
    { id: "system-documents-root", name: "내 문서" },
    { id: "folder", name: "사진" },
  ],
  totalBytes: 12,
  fileCount: 2,
  directoryCount: 1,
  widgetCount: 1,
};

describe("useFolderProperties", () => {
  it("loads details and refreshes the currently open folder", async () => {
    const getDirectoryDetails = vi.fn(async () => DETAILS);
    const { result } = renderHook(() =>
      useFolderProperties({ getDirectoryDetails } as unknown as FilesystemGateway),
    );

    act(() => result.current.open({ id: "folder", name: "사진" }));
    expect(result.current.state.status).toBe(FOLDER_PROPERTIES_STATUS.LOADING);
    await waitFor(() =>
      expect(result.current.state.status).toBe(FOLDER_PROPERTIES_STATUS.READY),
    );

    act(() => result.current.refresh());
    await waitFor(() => expect(getDirectoryDetails).toHaveBeenCalledTimes(2));
  });

  it("ignores a response that arrives after the dialog closes", async () => {
    let resolveDetails: (details: FilesystemDirectoryDetails) => void = () =>
      undefined;
    const pending = new Promise<FilesystemDirectoryDetails>((resolve) => {
      resolveDetails = resolve;
    });
    const gateway = {
      getDirectoryDetails: vi.fn(() => pending),
    } as unknown as FilesystemGateway;
    const { result } = renderHook(() => useFolderProperties(gateway));

    act(() => result.current.open({ id: "folder", name: "사진" }));
    act(() => result.current.close());
    await act(async () => resolveDetails(DETAILS));

    expect(result.current.state.status).toBe(FOLDER_PROPERTIES_STATUS.CLOSED);
  });
});
