import {
  IMAGE_UPLOAD_CONTENT_TYPE_VALUES,
  DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE,
} from "@/constants/integrations/image-upload-profile";
import { FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import type { ImageUploadProfileDraft } from "@client/types/integrations/image-upload-profile";

export const IMAGE_UPLOAD_PROFILE_CLASS_NAME = {
  TABS: "image-upload-profiles-widget__tabs",
  ROOT: "image-upload-profiles-widget",
  SIDEBAR: "image-upload-profiles-widget__sidebar",
  LIST: "image-upload-profiles-widget__list",
  LIST_ITEM: "image-upload-profiles-widget__list-item",
  LIST_ITEM_SELECTED: "image-upload-profiles-widget__list-item--selected",
  STATUS: "image-upload-profiles-widget__status",
  EDITOR: "image-upload-profiles-widget__editor",
  FORM: "image-upload-profiles-widget__form",
  FORM_FIELDS: "image-upload-profiles-widget__form-fields",
  FIELD: "image-upload-profiles-widget__field",
  HELP: "image-upload-profiles-widget__help",
  GROUP: "image-upload-profiles-widget__group",
  GROUP_CONTENT: "image-upload-profiles-widget__group-content",
  MIME_LIST: "image-upload-profiles-widget__mime-list",
  ENABLED: "image-upload-profiles-widget__enabled",
  PREVIEW: "image-upload-profiles-widget__preview",
  URL: "image-upload-profiles-widget__url",
  NOTICE: "image-upload-profiles-widget__notice",
} as const;

export const IMAGE_UPLOAD_PROFILE_FIELD_ID = {
  ID: "image-upload-profile-id",
  DISPLAY_NAME: "image-upload-profile-display-name",
  ROOT: "image-upload-profile-root",
  PATH_TEMPLATE: "image-upload-profile-path-template",
  FILE_NAME_TEMPLATE: "image-upload-profile-file-name-template",
  ENABLED: "image-upload-profile-enabled",
} as const;

export const EMPTY_IMAGE_UPLOAD_PROFILE_DRAFT = {
  id: "",
  displayName: "",
  rootId: FILESYSTEM_ROOT_ID.DESKTOP,
  pathTemplate: "{profileId}/{yyyy-MM-dd}",
  fileNameTemplate: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.FILE_NAME_TEMPLATE,
  enabled: true,
  contentTypes: [...IMAGE_UPLOAD_CONTENT_TYPE_VALUES],
} as const satisfies ImageUploadProfileDraft;
