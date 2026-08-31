import { GUEST_PUBLICATION_STATE } from "@/constants/admin/guest-access";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";

export const ADMIN_APPLICATION_COPY = {
  TITLE: "관리자",
  TABS_LABEL: "관리자 설정",
  GUEST_ACCESS_TAB: "게스트 공개",
} as const;

export const GUEST_ACCESS_COPY = {
  ENABLE: "게스트 접속 허용",
  ENABLED: "게스트 접속이 허용되어 있습니다.",
  DISABLED: "게스트 접속이 차단되어 있습니다. 공개 선택은 보존됩니다.",
  NOT_ACTIVE_YET:
    "게스트 화면은 다음 단계에서 연결됩니다. 현재 설정만 안전하게 저장합니다.",
  DESKTOP_ROOT: "바탕 화면",
  DOCUMENTS_ROOT: "내 문서",
  LOAD_FAILED: "게스트 공개 설정을 불러오지 못했습니다.",
  SAVE_FAILED: "게스트 공개 설정을 저장하지 못했습니다.",
  LOADING: "공개 설정을 불러오는 중…",
  RETRY: "다시 시도",
  EMPTY: "이 폴더에 공개할 항목이 없습니다.",
  LOAD_MORE: "더 보기",
  LOADING_MORE: "불러오는 중…",
  PUBLISH_DIRECTORY_TITLE: "폴더 공개",
  UNPUBLISH_DIRECTORY_TITLE: "폴더 공개 해제",
  PUBLISH_DIRECTORY_MESSAGE:
    "현재 폴더와 지금 존재하는 모든 하위 항목을 공개할까요? 이후 추가되는 항목은 자동으로 공개되지 않습니다.",
  UNPUBLISH_DIRECTORY_MESSAGE:
    "현재 폴더와 모든 하위 항목의 공개를 해제할까요?",
  PUBLISH: "공개",
  UNPUBLISH: "공개 해제",
  CANCEL: "취소",
  ENTRY_KIND: {
    [FILESYSTEM_ENTRY_KIND.DIRECTORY]: "폴더",
    [FILESYSTEM_ENTRY_KIND.FILE]: "파일",
    [FILESYSTEM_ENTRY_KIND.WIDGET]: "프로그램 문서",
  },
  STATE: {
    [GUEST_PUBLICATION_STATE.PRIVATE]: "비공개",
    [GUEST_PUBLICATION_STATE.PARTIAL]: "부분 공개",
    [GUEST_PUBLICATION_STATE.PUBLIC]: "공개",
  },
} as const;
