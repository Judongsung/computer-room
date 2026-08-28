import {
  IMAGE_UPLOAD_CONTENT_TYPE,
  IMAGE_UPLOAD_CONTENT_TYPE_VALUES,
  DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE,
} from "@/constants/integrations/image-upload-profile";
import {
  FILESYSTEM_ROOT_ID,
  FILESYSTEM_ROOT_NAME,
} from "@/constants/filesystem/filesystem";
import type {
  ImageUploadContentType,
  ImageUploadProfileRootId,
} from "@/types/integrations/image-upload-profile";
import type { ImageUploadProfileDraft } from "@client/types/integrations/image-upload-profile";

export const IMAGE_UPLOAD_PROFILE_COPY = {
  TITLE: "이미지 API 프로필",
  REFRESH: "새로 고침",
  NEW_PROFILE: "새 프로필",
  PROFILE_LIST: "프로필 목록",
  EMPTY: "등록된 프로필이 없습니다.",
  LOADING: "프로필을 불러오는 중…",
  LOAD_FAILED: "이미지 API 프로필을 불러오지 못했습니다.",
  RETRY: "다시 시도",
  ID: "프로필 ID",
  ID_HELP: "영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.",
  DISPLAY_NAME: "표시 이름",
  ROOT: "기준 위치",
  PATH_TEMPLATE: "상대 경로 템플릿",
  PATH_TEMPLATE_HELP: "비워 두면 기준 위치에 바로 저장합니다.",
  FILE_NAME_TEMPLATE: "파일명 템플릿",
  CONTENT_TYPES: "허용 이미지 형식",
  ENABLED: "이 프로필 활성화",
  ACTIVE: "활성",
  INACTIVE: "비활성",
  SAVE: "저장",
  SAVING: "저장 중…",
  DELETE: "삭제",
  DELETE_TITLE: "이미지 API 프로필 삭제",
  DELETE_MESSAGE: (name: string) =>
    `“${name}” 프로필을 삭제할까요? 기존 파일과 폴더는 유지되지만 이 업로드 URL은 즉시 중단됩니다.`,
  DELETE_CONFIRM: "프로필 삭제",
  SAVE_FAILED: "프로필을 저장하지 못했습니다.",
  DELETE_FAILED: "프로필을 삭제하지 못했습니다.",
  PREVIEW: "저장 경로 미리보기",
  PREVIEW_INVALID: "유효한 설정을 입력하면 미리보기가 표시됩니다.",
  UPLOAD_URL: "업로드 URL",
  COPY_URL: "URL 복사",
  COPY_COMPLETE: "업로드 URL을 복사했습니다.",
  COPY_FAILED: "업로드 URL을 복사하지 못했습니다.",
  SELECT_PROFILE: "왼쪽에서 프로필을 선택하거나 새 프로필을 만드세요.",
} as const;

export const IMAGE_UPLOAD_PROFILE_CLASS_NAME = {
  ROOT: "image-upload-profiles-widget",
  SIDEBAR: "image-upload-profiles-widget__sidebar",
  LIST: "image-upload-profiles-widget__list",
  LIST_ITEM: "image-upload-profiles-widget__list-item",
  LIST_ITEM_SELECTED: "image-upload-profiles-widget__list-item--selected",
  STATUS: "image-upload-profiles-widget__status",
  EDITOR: "image-upload-profiles-widget__editor",
  FORM: "image-upload-profiles-widget__form",
  FIELD: "image-upload-profiles-widget__field",
  HELP: "image-upload-profiles-widget__help",
  MIME_LIST: "image-upload-profiles-widget__mime-list",
  PREVIEW: "image-upload-profiles-widget__preview",
  URL: "image-upload-profiles-widget__url",
  ACTIONS: "image-upload-profiles-widget__actions",
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

export const IMAGE_UPLOAD_ROOT_LABEL = {
  [FILESYSTEM_ROOT_ID.DESKTOP]: FILESYSTEM_ROOT_NAME.DESKTOP,
  [FILESYSTEM_ROOT_ID.DOCUMENTS]: FILESYSTEM_ROOT_NAME.DOCUMENTS,
} as const satisfies Record<ImageUploadProfileRootId, string>;

export const IMAGE_UPLOAD_CONTENT_TYPE_LABEL = {
  [IMAGE_UPLOAD_CONTENT_TYPE.JPEG]: "JPEG",
  [IMAGE_UPLOAD_CONTENT_TYPE.PNG]: "PNG",
  [IMAGE_UPLOAD_CONTENT_TYPE.GIF]: "GIF",
  [IMAGE_UPLOAD_CONTENT_TYPE.WEBP]: "WebP",
  [IMAGE_UPLOAD_CONTENT_TYPE.AVIF]: "AVIF",
  [IMAGE_UPLOAD_CONTENT_TYPE.BMP]: "BMP",
} as const satisfies Record<ImageUploadContentType, string>;

export const EMPTY_IMAGE_UPLOAD_PROFILE_DRAFT = {
  id: "",
  displayName: "",
  rootId: FILESYSTEM_ROOT_ID.DESKTOP,
  pathTemplate: "{profileId}/{yyyy-MM-dd}",
  fileNameTemplate: DEFAULT_NOVELAI_IMAGE_UPLOAD_PROFILE.FILE_NAME_TEMPLATE,
  enabled: true,
  contentTypes: [...IMAGE_UPLOAD_CONTENT_TYPE_VALUES],
} as const satisfies ImageUploadProfileDraft;
