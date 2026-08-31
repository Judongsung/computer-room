import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CHECKLIST_WIDGET_COPY,
  DASHBOARD_COPY,
  MEMO_WIDGET_COPY,
} from "@client/content/ko/widgets/content";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { WIDGET_TYPE, WIDGET_WINDOW_POLICY, WINDOW_RESTORE_STATE, WINDOW_STATE } from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";
import type { StorageStatusSnapshot } from "@/types/storage/storage-status";

export async function openStartMenu(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.click(
    await screen.findByRole("button", { name: DASHBOARD_COPY.START }),
  );
}

export async function launchApplication(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
): Promise<void> {
  await openStartMenu(user);
  const startMenu = screen.getByLabelText(DASHBOARD_COPY.START_MENU);
  await user.click(within(startMenu).getByRole("button", { name: label }));
}

export function emptyStorageStatusSnapshot(): StorageStatusSnapshot {
  const empty = () => ({ bytes: 0, objectCount: 0 });
  return {
    measuredAt: "2026-08-23T12:34:56.789Z",
    r2: {
      total: empty(),
      standard: empty(),
      byPurpose: {
        original: empty(),
        thumbnail: empty(),
        other: empty(),
      },
      byMimeCategory: {
        image: empty(),
        video: empty(),
        audio: empty(),
        document: empty(),
        archive: empty(),
        other: empty(),
      },
    },
    d1: {
      databaseBytes: 0,
      registeredFileCount: 0,
      directoryCount: 0,
      widgetCount: 1,
      trashItemCount: 0,
    },
  };
}

export function memoWidget(id: string): DashboardWidget {
  const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
  return {
    id,
    type: WIDGET_TYPE.MEMO,
    position: { x: 32, y: 32 },
    size: {
      width: policy.DEFAULT_WIDTH,
      height: policy.DEFAULT_HEIGHT,
    },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
    stackOrder: 0,
    file: {
      entryId: `entry-${id}`,
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: MEMO_WIDGET_COPY.TITLE,
    },
    data: { markdown: "", updatedAt: null },
  };
}

export function checklistWidget(id: string, stackOrder: number): DashboardWidget {
  const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.DAILY_CHECKLIST];
  return {
    id,
    type: WIDGET_TYPE.DAILY_CHECKLIST,
    position: { x: 64, y: 64 },
    size: {
      width: policy.DEFAULT_WIDTH,
      height: policy.DEFAULT_HEIGHT,
    },
    windowState: WINDOW_STATE.NORMAL,
    restoreState: WINDOW_RESTORE_STATE.NORMAL,
    stackOrder,
    file: {
      entryId: `entry-${id}`,
      parentId: FILESYSTEM_ROOT_ID.DOCUMENTS,
      name: CHECKLIST_WIDGET_COPY.TITLE,
    },
    data: {
      businessDate: "2026-08-20",
      nextResetAt: "2026-08-20T15:00:00.000Z",
      items: [],
    },
  };
}

export function desktopWindowTitles(): Array<string | undefined> {
  return screen
    .queryAllByTestId("desktop-window")
    .map(
      (window) =>
        window.querySelector(".xp-window-frame__title")?.textContent ??
        undefined,
    );
}

export function desktopWindowByTitle(title: string): HTMLElement {
  const window = screen.getAllByTestId("desktop-window").find(
    (candidate) =>
      candidate.querySelector(".xp-window-frame__title")?.textContent ===
      title,
  );
  if (!window) {
    throw new Error(`Desktop window not found: ${title}`);
  }
  return window;
}
