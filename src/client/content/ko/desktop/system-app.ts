import { FILESYSTEM_ROOT_NAME } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_SEARCH_COPY } from "@client/content/ko/filesystem/search";
import { SYSTEM_APP_ID } from "@client/constants/desktop/system-app";
import type { SystemAppId } from "@client/types/desktop/system-app";

export const SYSTEM_APP_TITLE_BY_ID = {
  [SYSTEM_APP_ID.SEARCH]: FILESYSTEM_SEARCH_COPY.TITLE,
  [SYSTEM_APP_ID.DOCUMENTS]: FILESYSTEM_ROOT_NAME.DOCUMENTS,
  [SYSTEM_APP_ID.MY_COMPUTER]: "내 컴퓨터",
  [SYSTEM_APP_ID.RECYCLE_BIN]: FILESYSTEM_ROOT_NAME.RECYCLE_BIN,
} as const satisfies Record<SystemAppId, string>;
