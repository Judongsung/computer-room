import { WIDGET_TYPE } from "@/constants/widgets/widget";

export const MOBILE_ASSET_PATHS = {
  DOCUMENTS: "/assets/android/documents.svg",
  COMPUTER: "/assets/android/computer.svg",
  RECYCLE_BIN: "/assets/android/recycle-bin.svg",
  FOLDER: "/assets/android/folder.svg",
  FILE: "/assets/android/file.svg",
  MEMO: "/assets/android/memo.svg",
  CHECKLIST: "/assets/android/checklist.svg",
  STORAGE_STATUS: "/assets/android/storage-status.svg",
} as const;

export const MOBILE_WIDGET_ICON_PATH = {
  [WIDGET_TYPE.MEMO]: MOBILE_ASSET_PATHS.MEMO,
  [WIDGET_TYPE.DAILY_CHECKLIST]: MOBILE_ASSET_PATHS.CHECKLIST,
  [WIDGET_TYPE.STORAGE_STATUS]: MOBILE_ASSET_PATHS.STORAGE_STATUS,
} as const satisfies Partial<
  Record<(typeof WIDGET_TYPE)[keyof typeof WIDGET_TYPE], string>
>;
