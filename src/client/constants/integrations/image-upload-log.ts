import { IMAGE_UPLOAD_LOG_OUTCOME } from "@/constants/integrations/image-upload-log";

export const IMAGE_UPLOAD_PROFILES_TAB = {
  PROFILES: "profiles",
  LOGS: "logs",
} as const;

export type ImageUploadProfilesTab =
  (typeof IMAGE_UPLOAD_PROFILES_TAB)[keyof typeof IMAGE_UPLOAD_PROFILES_TAB];

export const IMAGE_UPLOAD_LOG_FILTER_VALUE = {
  ALL: "",
  SUCCESS: IMAGE_UPLOAD_LOG_OUTCOME.SUCCESS,
  FAILURE: IMAGE_UPLOAD_LOG_OUTCOME.FAILURE,
} as const;

export const IMAGE_UPLOAD_LOG_CLASS_NAME = {
  ROOT: "image-upload-logs",
  SETTINGS: "image-upload-logs__settings",
  SETTINGS_ROW: "image-upload-logs__settings-row",
  SETTINGS_ERROR: "image-upload-logs__settings-error",
  FILTERS: "image-upload-logs__filters",
  TABLE_WRAPPER: "image-upload-logs__table-wrapper",
  TABLE: "image-upload-logs__table",
  OUTCOME: "image-upload-logs__outcome",
  OUTCOME_SUCCESS: "image-upload-logs__outcome--success",
  OUTCOME_FAILURE: "image-upload-logs__outcome--failure",
  DETAIL: "image-upload-logs__detail",
  ERROR: "image-upload-logs__error",
  FOOTER: "image-upload-logs__footer",
  NOTICE: "image-upload-logs__notice",
} as const;
