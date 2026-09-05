export const NATIVE_FILE_DRAG_DATA_TYPE = "Files";
export const DIRECTORY_CONTENT_DROP_TARGET = "directory-content";

export const FILESYSTEM_DROP_EFFECT = {
  MOVE: "move",
  COPY: "copy",
  NONE: "none",
} as const;

export const FILESYSTEM_DRAG_EVENT = {
  DROP: "drop",
  END: "dragend",
} as const;

export const FILESYSTEM_DROP_ATTRIBUTE = {
  TARGET: "data-filesystem-drop-target",
  BOUNDARY: "data-filesystem-drop-boundary",
} as const;

export const FILESYSTEM_DROP_OWNER_SELECTOR =
  `[${FILESYSTEM_DROP_ATTRIBUTE.TARGET}], [${FILESYSTEM_DROP_ATTRIBUTE.BOUNDARY}]`;
