import { MEDIA_KIND } from "@/constants/filesystem/media";

export const MEDIA_VIEWER_TITLE_BY_KIND = {
  [MEDIA_KIND.IMAGE]: "Windows 사진 및 팩스 뷰어",
  [MEDIA_KIND.VIDEO]: "Windows Media Player",
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
  OPEN_NEW_TAB: "새 탭에서 열기",
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
  DOWNLOAD_FILE: "파일 다운로드",
  PLAYER_STATUS_READY: "준비",
} as const;
