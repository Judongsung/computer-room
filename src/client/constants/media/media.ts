import { MEDIA_KIND } from "@/constants/filesystem/media";
import { DESKTOP_ASSET_PATHS } from "@client/constants/desktop/desktop";
import { KEYBOARD_KEY } from "@client/constants/shared/keyboard";

export const MEDIA_WINDOW_ID_PREFIX = "media-window-";

export const MEDIA_VIEWER_TITLE_BY_KIND = {
  [MEDIA_KIND.IMAGE]: "Windows 사진 및 팩스 뷰어",
  [MEDIA_KIND.VIDEO]: "Windows Media Player",
} as const;

export const MEDIA_WINDOW_CONFIG = {
  [MEDIA_KIND.IMAGE]: {
    titleSuffix: MEDIA_VIEWER_TITLE_BY_KIND[MEDIA_KIND.IMAGE],
    iconPath: DESKTOP_ASSET_PATHS.PICTURE_VIEWER_ICON,
    size: { width: 720, height: 540 },
    minWidth: 480,
    minHeight: 360,
  },
  [MEDIA_KIND.VIDEO]: {
    titleSuffix: MEDIA_VIEWER_TITLE_BY_KIND[MEDIA_KIND.VIDEO],
    iconPath: DESKTOP_ASSET_PATHS.MEDIA_PLAYER_ICON,
    size: { width: 760, height: 560 },
    minWidth: 560,
    minHeight: 420,
  },
} as const;

export const MEDIA_VIEWER_COPY = {
  PICTURE_TOOLBAR: "사진 보기 도구",
  PLAYER_BRAND: MEDIA_VIEWER_TITLE_BY_KIND[MEDIA_KIND.VIDEO],
  PREVIOUS: "이전 미디어",
  NEXT: "다음 미디어",
  FIT_TO_WINDOW: "창에 맞춤",
  ACTUAL_SIZE: "실제 크기",
  ZOOM_OUT: "축소",
  ZOOM_IN: "확대",
  ROTATE_LEFT: "왼쪽으로 회전",
  ROTATE_RIGHT: "오른쪽으로 회전",
  DOWNLOAD: "다운로드",
  PLAY: "재생",
  PAUSE: "일시정지",
  MUTE: "음소거",
  UNMUTE: "음소거 해제",
  VOLUME: "볼륨",
  SEEK: "재생 위치",
  FULLSCREEN: "전체 화면",
  LOADING: "미디어를 불러오는 중입니다…",
  LOAD_FAILED: "미디어를 표시할 수 없습니다.",
  NAVIGATION_FAILED: "폴더의 미디어 목록을 불러오지 못했습니다.",
  UNSUPPORTED_TITLE: "파일을 열 수 없음",
  UNSUPPORTED_MESSAGE:
    "이 이미지 또는 영상 형식은 브라우저 뷰어에서 지원하지 않습니다. 파일을 다운로드할까요?",
  DOWNLOAD_FILE: "파일 다운로드",
  CANCEL: "취소",
  PLAYER_STATUS_READY: "준비",
} as const;

export const IMAGE_VIEWER_ZOOM_MODE = {
  FIT: "fit",
  MANUAL: "manual",
} as const;

export const MEDIA_KEYBOARD_KEY = {
  PREVIOUS: KEYBOARD_KEY.ARROW_LEFT,
  NEXT: KEYBOARD_KEY.ARROW_RIGHT,
  ZOOM_IN: KEYBOARD_KEY.PLUS,
  ZOOM_IN_ALTERNATE: KEYBOARD_KEY.EQUAL,
  ZOOM_OUT: KEYBOARD_KEY.MINUS,
  ACTUAL_SIZE: KEYBOARD_KEY.ZERO,
} as const;

export const MEDIA_TOOLBAR_GLYPH = {
  PREVIOUS: "◀",
  NEXT: "▶",
  FIT_TO_WINDOW: "▣",
  ACTUAL_SIZE: "1:1",
  ZOOM_OUT: "−",
  ZOOM_IN: "+",
  ROTATE_LEFT: "↶",
  ROTATE_RIGHT: "↷",
  DOWNLOAD: "⇩",
  PLAY: "▶",
  PAUSE: "Ⅱ",
  MUTE: "◀))",
  UNMUTE: "×",
  FULLSCREEN: "□",
} as const;

export const IMAGE_VIEWER_ZOOM = {
  MINIMUM: 0.1,
  MAXIMUM: 8,
  FACTOR: 1.25,
  ACTUAL_SIZE: 1,
} as const;

export const IMAGE_ROTATION_STEP_DEGREES = 90;
export const IMAGE_FULL_ROTATION_DEGREES = 360;
export const PERCENT_MULTIPLIER = 100;
export const MEDIA_TIME_FALLBACK_SECONDS = 0;
export const MEDIA_NAVIGATION_INITIAL_OFFSET = 0;
export const PICTURE_VIEWER_CANVAS_PADDING_PX = 24;
export const MEDIA_SECONDS_PER_MINUTE = 60;
export const MEDIA_TIME_PAD_LENGTH = 2;
export const MEDIA_TIME_PAD_CHARACTER = "0";
export const MEDIA_SEEK_STEP_SECONDS = 0.1;
export const MEDIA_VOLUME_RANGE = {
  MINIMUM: 0,
  MAXIMUM: 1,
  STEP: 0.05,
} as const;

export const EMPTY_ELEMENT_SIZE = { width: 0, height: 0 } as const;
