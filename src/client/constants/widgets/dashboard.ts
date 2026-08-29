export const LOAD_STATUS = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
} as const;

export const MESSAGE_KIND = {
  INFO: "info",
  SUCCESS: "success",
  ERROR: "error",
} as const;

export const DASHBOARD_ACTION_TYPE = {
  LOAD_STARTED: "load-started",
  LOAD_SUCCEEDED: "load-succeeded",
  LOAD_FAILED: "load-failed",
  WIDGETS_REPLACED: "widgets-replaced",
  MESSAGE_SET: "message-set",
} as const;
