import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import {
  WIDGET_TYPE,
  WIDGET_WINDOW_POLICY,
  WINDOW_RESTORE_STATE,
  WINDOW_STATE,
} from "@/constants/widgets/widget";
import type { DashboardWidget } from "@/types/widgets/widget";
import { CHECKLIST_WIDGET_COPY, MEMO_WIDGET_COPY } from "@client/content/ko/widgets/content";

export function memoWidget(id: string): DashboardWidget {
  const policy = WIDGET_WINDOW_POLICY[WIDGET_TYPE.MEMO];
  return {
    id,
    type: WIDGET_TYPE.MEMO,
    position: { x: 32, y: 32 },
    size: { width: policy.DEFAULT_WIDTH, height: policy.DEFAULT_HEIGHT },
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
    size: { width: policy.DEFAULT_WIDTH, height: policy.DEFAULT_HEIGHT },
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
