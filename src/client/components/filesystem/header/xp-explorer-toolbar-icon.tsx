import type { ReactNode } from "react";
import {
  XP_EXPLORER_HEADER_CLASS_NAME,
  XP_EXPLORER_TOOLBAR_ACTION,
} from "@client/constants/filesystem/explorer-header";
import type { XpExplorerToolbarAction } from "@client/types/filesystem/explorer-header";

const COMMON_SVG_PROPS = {
  viewBox: "0 0 24 24",
  "aria-hidden": true,
  focusable: false,
} as const;

const TOOLBAR_ICON_BY_ACTION = {
  [XP_EXPLORER_TOOLBAR_ACTION.SEARCH]: (
    <svg {...COMMON_SVG_PROPS}>
      <circle cx="10" cy="10" r="6" fill="#e5f4ff" stroke="#34689b" strokeWidth="2" />
      <path d="m15 15 6 6" stroke="#735029" strokeWidth="4" />
    </svg>
  ),
  [XP_EXPLORER_TOOLBAR_ACTION.BACK]: (
    <svg {...COMMON_SVG_PROPS}>
      <circle cx="12" cy="12" r="10" fill="#3ba322" stroke="#19630d" />
      <path d="M13.5 6.5 8 12l5.5 5.5M8.5 12H18" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  [XP_EXPLORER_TOOLBAR_ACTION.UP]: (
    <svg {...COMMON_SVG_PROPS}>
      <path d="M2.5 7.5h7l1.8 2H21v10H2.5z" fill="#f5cb45" stroke="#9b6d00" />
      <path d="M12 17V8m0 0-3 3m3-3 3 3" fill="none" stroke="#2a8b24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  [XP_EXPLORER_TOOLBAR_ACTION.NEW_FOLDER]: (
    <svg {...COMMON_SVG_PROPS}>
      <path d="M2 6h7l2 2h11v12H2z" fill="#ffd85a" stroke="#a87600" />
      <path d="M17 10v7m-3.5-3.5h7" stroke="#198619" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  [XP_EXPLORER_TOOLBAR_ACTION.UPLOAD_FILES]: (
    <svg {...COMMON_SVG_PROPS}>
      <path d="M5 2h9l5 5v15H5z" fill="#fff" stroke="#657a9a" />
      <path d="M14 2v5h5" fill="#c9ddf6" stroke="#657a9a" />
      <path d="M12 18V9m0 0-3 3m3-3 3 3" fill="none" stroke="#2475d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  [XP_EXPLORER_TOOLBAR_ACTION.DOWNLOAD]: (
    <svg {...COMMON_SVG_PROPS}>
      <path d="M5 2h9l5 5v15H5z" fill="#fff" stroke="#657a9a" />
      <path d="M14 2v5h5" fill="#c9ddf6" stroke="#657a9a" />
      <path d="M12 8v9m0 0-3-3m3 3 3-3" fill="none" stroke="#2a8b24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  [XP_EXPLORER_TOOLBAR_ACTION.DELETE]: redCrossIcon(),
  [XP_EXPLORER_TOOLBAR_ACTION.RESTORE]: (
    <svg {...COMMON_SVG_PROPS}>
      <path d="M7 8H3l3-4" fill="none" stroke="#198619" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 8a9 9 0 1 1 1 9" fill="none" stroke="#2c9a24" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  [XP_EXPLORER_TOOLBAR_ACTION.PERMANENT_DELETE]: redCrossIcon(),
  [XP_EXPLORER_TOOLBAR_ACTION.EMPTY_RECYCLE_BIN]: (
    <svg {...COMMON_SVG_PROPS}>
      <path d="M7 7h10l-1 14H8z" fill="#dbe7f5" stroke="#4c668a" />
      <path d="M6 5h12M9 5l1-2h4l1 2" fill="none" stroke="#4c668a" strokeWidth="1.5" />
      <path d="m17 2 .5 1.5L19 4l-1.5.5L17 6l-.5-1.5L15 4l1.5-.5z" fill="#ffca28" />
    </svg>
  ),
  [XP_EXPLORER_TOOLBAR_ACTION.RUN_APPLICATION]: (
    <svg {...COMMON_SVG_PROPS}>
      <circle cx="12" cy="12" r="10" fill="#2d9a25" stroke="#17620f" />
      <path d="m9 7 8 5-8 5z" fill="#fff" />
    </svg>
  ),
} satisfies Record<XpExplorerToolbarAction, ReactNode>;

export function XpExplorerToolbarIcon({
  action,
}: {
  readonly action: XpExplorerToolbarAction;
}) {
  return (
    <span className={XP_EXPLORER_HEADER_CLASS_NAME.COMMAND_ICON}>
      {TOOLBAR_ICON_BY_ACTION[action]}
    </span>
  );
}
function redCrossIcon(): ReactNode {
  return (
    <svg {...COMMON_SVG_PROPS}>
      <circle cx="12" cy="12" r="10" fill="#e33d31" stroke="#8e160e" />
      <path d="m8 8 8 8m0-8-8 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
