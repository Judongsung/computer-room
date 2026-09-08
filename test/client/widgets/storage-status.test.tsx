import { STORAGE_STATUS_COPY } from "@client/content/ko/storage/storage-status";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StorageStatusWidget } from "@client/components/widgets/storage-status-widget";
import { STORAGE_USAGE_LEVEL } from "@client/constants/storage/storage-status";
import {
  storageGraphPercent,
  storageUsageLevel,
  storageUsagePercent,
} from "@client/domain/storage/storage-status";
import type { StorageStatusGateway } from "@client/types/storage/storage-status";
import {
  STORAGE_FREE_REFERENCE_BYTES,
} from "@/constants/storage/storage-status";

import type { StorageStatusSnapshot } from "@/types/storage/storage-status";

describe("storage status presentation", () => {
  it("classifies zero, warning, limit, and over-limit usage", () => {
    expect(storageUsagePercent(0, 10)).toBe(0);
    expect(storageUsageLevel(79.9)).toBe(STORAGE_USAGE_LEVEL.NORMAL);
    expect(storageUsageLevel(80)).toBe(STORAGE_USAGE_LEVEL.WARNING);
    expect(storageUsageLevel(100)).toBe(STORAGE_USAGE_LEVEL.EXCEEDED);
    expect(storageUsageLevel(125)).toBe(STORAGE_USAGE_LEVEL.EXCEEDED);
    expect(storageGraphPercent(0, 0)).toBe(0);
    expect(storageGraphPercent(25, 100)).toBe(25);
  });

  it("loads once when opened and refreshes only on request", async () => {
    const getStatus = vi.fn().mockResolvedValue(snapshot());
    const user = userEvent.setup();
    renderWidget({ getStatus });

    expect(await screen.findByText(STORAGE_STATUS_COPY.R2_TITLE)).toBeInTheDocument();
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByText(STORAGE_STATUS_COPY.WARNING)).toBeInTheDocument();
    expect(screen.getByText(STORAGE_STATUS_COPY.EXCEEDED)).toBeInTheDocument();
    expect(screen.getByText(STORAGE_STATUS_COPY.R2_FREE_REFERENCE_NOTE)).toBeInTheDocument();
    expect(screen.getByText("이미지")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: STORAGE_STATUS_COPY.REFRESH }));
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(2));
  });

  it("keeps a retry action after an error", async () => {
    const getStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error("측정 실패"))
      .mockResolvedValueOnce(snapshot());
    const user = userEvent.setup();
    renderWidget({ getStatus });

    expect(await screen.findByRole("alert")).toHaveTextContent("측정 실패");
    await user.click(screen.getByRole("button", { name: STORAGE_STATUS_COPY.RETRY }));
    expect(await screen.findByText(STORAGE_STATUS_COPY.R2_TITLE)).toBeInTheDocument();
    expect(getStatus).toHaveBeenCalledTimes(2);
  });
});

function renderWidget(storageStatusGateway: StorageStatusGateway): void {
  render(
    <StorageStatusWidget
      windowControls={{
        isActive: true,
        isMaximized: false,
        onFocus: vi.fn(),
        onMinimize: vi.fn(),
        onToggleMaximize: vi.fn(),
        onClose: vi.fn(),
        onSaveFile: vi.fn(),
        canSaveFile: false,
      }}
      storageStatusGateway={storageStatusGateway}
    />,
  );
}

function snapshot(): StorageStatusSnapshot {
  const empty = () => ({ bytes: 0, objectCount: 0 });
  return {
    measuredAt: "2026-08-23T12:34:56.789Z",
    r2: {
      total: { bytes: STORAGE_FREE_REFERENCE_BYTES.R2_STANDARD, objectCount: 2 },
      standard: { bytes: STORAGE_FREE_REFERENCE_BYTES.R2_STANDARD, objectCount: 2 },
      byPurpose: {
        original: { bytes: STORAGE_FREE_REFERENCE_BYTES.R2_STANDARD, objectCount: 2 },
        thumbnail: empty(),
        other: empty(),
      },
      byMimeCategory: {
        image: { bytes: STORAGE_FREE_REFERENCE_BYTES.R2_STANDARD, objectCount: 2 },
        video: empty(),
        audio: empty(),
        document: empty(),
        archive: empty(),
        other: empty(),
      },
    },
    d1: {
      databaseBytes: STORAGE_FREE_REFERENCE_BYTES.D1_DATABASE * 0.8,
      registeredFileCount: 2,
      directoryCount: 1,
      widgetCount: 1,
      trashItemCount: 0,
    },
  };
}
