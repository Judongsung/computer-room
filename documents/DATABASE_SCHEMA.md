# D1 데이터베이스 명세

[문서 목차로 돌아가기](./INDEX.md)

이 문서는 `migrations/0000_superb_hitman.sql`부터
`migrations/0015_db-indexes-checklist-retention.sql`까지 모든 마이그레이션을 적용한
최종 애플리케이션 스키마를 설명한다.

Wrangler가 관리하는 마이그레이션 이력 등의 내부 테이블은 제외한다.
애플리케이션이 직접 관리하는 테이블은 총 17개다.

## 공통 규칙

| 표기 | 의미 |
|---|---|
| `TEXT` | SQLite 문자열 값이다. 별도 설명이 없는 ID는 애플리케이션이 생성하는 불투명한 문자열이다. |
| 시간 `INTEGER` | Unix epoch 밀리초 값이다. |
| 불리언 `INTEGER` | `0`은 거짓, `1`은 참이다. |
| Nullable | `YES`인 컬럼은 `NULL`을 허용한다. |
| `business_date` | 애플리케이션이 한국 시간 기준 `YYYY-MM-DD` 형식으로 저장한다. |
| `CASCADE` | 참조 대상 삭제 시 종속 행도 함께 삭제한다. |
| `SET NULL` | 참조 대상 삭제 시 외래 키 값을 `NULL`로 변경한다. |

## 테이블 목록

| 영역 | 테이블 | 책임 |
|---|---|---|
| 파일 저장 | `files` | 비공개 R2 객체의 메타데이터를 저장한다. |
| 파일 시스템 | `filesystem_entries` | 폴더·일반 파일·프로그램 문서 계층을 저장한다. |
| 파일 시스템 | `desktop_entry_order` | 동적 바탕 화면 항목 순서를 저장한다. |
| 파일 시스템 | `filesystem_directory_preferences` | 폴더별 정렬 설정을 저장한다. |
| 프로그램 | `dashboard_widgets` | 프로그램 창 배치와 복원 가능한 열림 상태를 저장한다. |
| 프로그램 | `memo_widgets` | 메모 프로그램의 마크다운 본문을 저장한다. |
| 체크리스트 | `checklist_items` | 일일 체크리스트 항목을 저장한다. |
| 체크리스트 | `checklist_daily_states` | 날짜별 체크 상태를 저장한다. |
| 체크리스트 | `checklist_events` | 체크리스트 변경 이력을 저장한다. |
| 체크리스트 | `checklist_settings` | 계정 공통 기록 보관 기간을 저장한다. 기본값은 무기한이다. |
| 모바일 | `mobile_preferences` | 계정 공용 모바일 설정을 저장한다. |
| 관리자 | `guest_access_settings` | 게스트 접속 마스터 설정을 저장한다. |
| 관리자 | `guest_publications` | 게스트에게 공개하도록 선택한 파일 시스템 항목을 저장한다. |
| 외부 연동 | `integration_image_profiles` | 이미지 수신 API 프로필을 저장한다. |
| 외부 연동 | `integration_image_profile_content_types` | 이미지 수신 프로필별 허용 MIME을 저장한다. |
| 외부 연동 | `integration_image_upload_log_settings` | 이미지 수신 기록의 계정 공용 보관 기간을 저장한다. |
| 외부 연동 | `integration_image_upload_logs` | 인증을 통과한 이미지 수신 요청의 성공·실패 기록을 저장한다. |

## 관계

```text
files
└── filesystem_entries.file_id

dashboard_widgets
├── memo_widgets.widget_id
├── checklist_items.widget_id
│   └── checklist_daily_states.item_id
├── checklist_events.widget_id
└── filesystem_entries.widget_id

filesystem_entries
├── filesystem_entries.parent_id
├── filesystem_entries.restore_parent_id
├── desktop_entry_order.entry_id
├── filesystem_directory_preferences.directory_id
└── mobile_preferences.wallpaper_entry_id

filesystem_entries
└── guest_publications.entry_id

integration_image_profiles
└── integration_image_profile_content_types.profile_id

integration_image_upload_logs
└── 파일·프로필 삭제 후에도 보존되는 독립 이력

integration_image_upload_log_settings
└── 다른 행을 참조하지 않는 단일 설정
```

## `files`

비공개 R2에 저장된 파일 바이트의 메타데이터를 관리한다. 파일 시스템에서
이름을 변경하거나 위치를 이동해도 `object_key`는 변경되지 않는다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `id` | `TEXT` | NO | - | 기본 키 | 파일 메타데이터 ID다. |
| `object_key` | `TEXT` | NO | - | UNIQUE | 비공개 R2 객체 키다. |
| `original_name` | `TEXT` | NO | - | - | 최초 업로드 당시의 파일명이다. |
| `content_type` | `TEXT` | NO | - | - | 객체의 MIME 타입이다. |
| `size` | `INTEGER` | NO | - | `0 <= size <= 100000000` | 원본 객체 크기다. 단위는 바이트다. |
| `etag` | `TEXT` | YES | `NULL` | - | 업로드 성공 후 기록한 R2 ETag다. |
| `status` | `TEXT` | NO | `'pending'` | `pending` 또는 `ready` | 업로드 준비 상태다. |
| `created_at` | `INTEGER` | NO | - | - | 메타데이터 생성 시각이다. |

### 인덱스

| 인덱스 | 컬럼 | 종류 | 목적 |
|---|---|---|---|
| `files_object_key_unique` | `object_key` | UNIQUE | 하나의 R2 키를 여러 메타데이터 행이 참조하지 못하게 한다. |
| `idx_files_status_created_at` | `status`, `created_at` | 일반 | 상태와 생성 시각을 이용한 조회를 지원한다. |

## `filesystem_entries`

운영체제와 유사한 파일 시스템 계층을 표현한다. 폴더, 일반 파일, 프로그램 문서가
하나의 트리를 공유한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `id` | `TEXT` | NO | - | 기본 키 | 파일 시스템 항목 ID다. |
| `parent_id` | `TEXT` | YES | `NULL` | `filesystem_entries.id` FK, `ON DELETE CASCADE` | 부모 폴더다. 시스템 루트는 부모가 없다. |
| `kind` | `TEXT` | NO | - | `directory`, `file`, `widget` | 항목 종류다. |
| `name` | `TEXT` | NO | - | - | 사용자에게 표시하는 이름이다. |
| `name_key` | `TEXT` | NO | - | 활성 형제 이름 UNIQUE에 사용 | 대소문자를 무시한 이름 충돌 검사에 사용하는 정규화 키다. |
| `file_id` | `TEXT` | YES | `NULL` | UNIQUE, `files.id` FK, `ON DELETE CASCADE` | 일반 파일의 메타데이터 참조다. |
| `widget_id` | `TEXT` | YES | `NULL` | UNIQUE, `dashboard_widgets.id` FK, `ON DELETE CASCADE` | 프로그램 문서가 참조하는 내부 프로그램 ID다. 이름은 호환성을 위해 유지한다. |
| `restore_parent_id` | `TEXT` | YES | `NULL` | `filesystem_entries.id` FK, `ON DELETE SET NULL` | 휴지통에서 복원할 때 사용하는 원래 부모다. |
| `restore_path` | `TEXT` | YES | `NULL` | - | 휴지통에 표시하고 복원에 참고하는 원래 경로다. |
| `trashed_at` | `INTEGER` | YES | `NULL` | - | 최상위 항목이 휴지통으로 이동한 시각이다. |
| `created_at` | `INTEGER` | NO | - | - | 항목 생성 시각이다. |
| `updated_at` | `INTEGER` | NO | - | - | 마지막 메타데이터 변경 시각이다. |

### 종류별 무결성 규칙

| `kind` | `file_id` | `widget_id` |
|---|---|---|
| `directory` | 반드시 `NULL` | 반드시 `NULL` |
| `file` | 필수 | 반드시 `NULL` |
| `widget` | 반드시 `NULL` | 필수 |

### 시스템 루트 행

| ID | 이름 | 용도 |
|---|---|---|
| `system-desktop-root` | `바탕 화면` | 동적 바탕 화면 파일과 폴더를 관리한다. |
| `system-documents-root` | `내 문서` | 기본 문서 계층을 관리한다. |
| `system-recycle-bin-root` | `휴지통` | 삭제된 최상위 항목을 관리한다. |

### 인덱스

| 인덱스 | 컬럼 | 종류 | 목적 |
|---|---|---|---|
| `filesystem_entries_file_id_unique` | `file_id` | UNIQUE | 하나의 파일 메타데이터가 최대 한 항목에만 속하게 한다. |
| `filesystem_entries_widget_id_unique` | `widget_id` | UNIQUE | 하나의 프로그램이 최대 한 프로그램 문서에만 속하게 한다. |
| `uq_filesystem_entries_active_parent_name` | `parent_id`, `name_key` | `trashed_at IS NULL`인 행의 부분 UNIQUE | 활성 상태인 형제 항목의 이름 충돌을 막는다. |
| `idx_filesystem_entries_active_name` | `parent_id`, 폴더 우선 CASE 식, `name_key`, `id` | 활성 행 부분 인덱스 | 폴더 우선 이름 오름차순 조회를 추가 정렬 없이 지원한다. |
| `idx_filesystem_entries_restore_parent` | `restore_parent_id` | NULL이 아닌 행 부분 인덱스 | 폴더 영구 삭제 시 복원 위치 참조를 찾는다. |
| `idx_filesystem_entries_trash` | `parent_id`, `trashed_at` | 일반 | 휴지통 목록 조회를 지원한다. |

## `desktop_entry_order`

바탕 화면에 배치된 동적 항목의 순서를 보관한다. 내 문서·내 컴퓨터·휴지통과
같은 고정 바로가기는 이 테이블에 저장하지 않는다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `entry_id` | `TEXT` | NO | - | 기본 키, `filesystem_entries.id` FK, `ON DELETE CASCADE` | 바탕 화면 항목이다. |
| `sort_order` | `INTEGER` | NO | - | UNIQUE, `sort_order >= 0` | 0부터 시작하는 바탕 화면 배치 순서다. |

### 인덱스

| 인덱스 | 컬럼 | 종류 | 목적 |
|---|---|---|---|
| `desktop_entry_order_sort_order_unique` | `sort_order` | UNIQUE | 순서 중복 방지와 정렬된 조회를 함께 지원한다. |

## `filesystem_directory_preferences`

각 폴더의 정렬 설정을 독립적으로 저장한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `directory_id` | `TEXT` | NO | - | 기본 키, `filesystem_entries.id` FK, `ON DELETE CASCADE` | 설정 대상 폴더다. |
| `sort_field` | `TEXT` | NO | - | `name`, `createdAt`, `updatedAt`, `type`, `size` | 선택한 정렬 필드다. |
| `sort_direction` | `TEXT` | NO | - | `ascending` 또는 `descending` | 선택한 정렬 방향이다. |

## `dashboard_widgets`

모든 프로그램의 영속 창 배치와 쌓임 순서를 저장한다. 문서 저장을 지원하는 프로그램은 열림 상태도 복원하며, 문서 저장을 지원하지 않는 내장 프로그램은 `is_open = 0`을 유지하고 현재 클라이언트 세션에서만 열린다. 테이블·컬럼의 `widget` 명칭은 기존 데이터와 API 호환성을 위한 레거시 저장소 용어다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `id` | `TEXT` | NO | - | 기본 키 | 프로그램 ID다. |
| `type` | `TEXT` | NO | `'memo'` | 지원 프로그램 타입 | 프로그램 동작을 구분한다. |
| `position_x` | `INTEGER` | NO | - | `0 <= position_x <= 8192` | 데스크톱 X 위치다. 단위는 픽셀이다. |
| `position_y` | `INTEGER` | NO | - | `0 <= position_y <= 8192` | 데스크톱 Y 위치다. 단위는 픽셀이다. |
| `width` | `INTEGER` | NO | - | `0 < width <= 4096` | 창 너비다. 단위는 픽셀이다. |
| `height` | `INTEGER` | NO | - | `0 < height <= 2160` | 창 높이다. 단위는 픽셀이다. |
| `window_state` | `TEXT` | NO | `'normal'` | `normal`, `minimized`, `maximized` | 현재 창 상태다. |
| `restore_state` | `TEXT` | NO | `'normal'` | `normal` 또는 `maximized` | 최소화 해제 시 복원할 상태다. |
| `stack_order` | `INTEGER` | NO | - | `stack_order >= 0` | 프로그램 창의 Z 순서다. |
| `is_open` | `INTEGER` | NO | `1` | `0` 또는 `1` | 다음 접속에서 복원할 열림 여부다. 문서 저장 불가 프로그램은 `0`을 유지한다. |

### 지원 프로그램 타입

| 값 | 의미 |
|---|---|
| `memo` | 마크다운 메모 프로그램이다. |
| `daily-checklist` | 일일 체크리스트 프로그램이다. |
| `storage-status` | 단일 저장소 상태 프로그램이다. |
| `image-upload-profiles` | 단일 이미지 API 프로필 관리 프로그램이다. |
| `admin` | 단일 관리자 프로그램이다. |

### 인덱스

| 인덱스 | 컬럼 | 종류 | 목적 |
|---|---|---|---|
| `idx_dashboard_widgets_stack_order` | `stack_order` | 일반 | 안정적인 창 쌓임 순서 조회를 지원한다. |
| `uq_dashboard_widgets_storage_status` | `type` | `storage-status`에 대한 부분 UNIQUE | 저장소 상태 프로그램을 하나만 허용한다. |
| `uq_dashboard_widgets_image_upload_profiles` | `type` | `image-upload-profiles`에 대한 부분 UNIQUE | 이미지 API 프로필 프로그램을 하나만 허용한다. |
| `uq_dashboard_widgets_admin` | `type` | `admin`에 대한 부분 UNIQUE | 관리자 프로그램을 하나만 허용한다. |

## `memo_widgets`

창 배치와 분리된 메모 전용 데이터를 저장한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `widget_id` | `TEXT` | NO | - | 기본 키, `dashboard_widgets.id` FK, `ON DELETE CASCADE` | 소유 메모 프로그램이다. |
| `markdown` | `TEXT` | NO | `''` | - | 마크다운 원문이다. |
| `updated_at` | `INTEGER` | YES | `NULL` | - | 마지막 본문 수정 시각이다. |

## `checklist_items`

매일 재사용하는 체크리스트 항목 정의를 저장한다. UI의 삭제는
`archived_at`을 기록하는 방식이므로 과거 이력이 항목과 연결된 상태로 남는다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `id` | `TEXT` | NO | - | 기본 키 | 체크리스트 항목 ID다. |
| `widget_id` | `TEXT` | NO | - | `dashboard_widgets.id` FK, `ON DELETE CASCADE` | 소유 체크리스트 프로그램이다. |
| `label` | `TEXT` | NO | - | 길이 1~200자 | 현재 항목 이름이다. |
| `sort_order` | `INTEGER` | NO | - | `sort_order >= 0` | 프로그램 내 표시 순서다. |
| `created_at` | `INTEGER` | NO | - | - | 생성 시각이다. |
| `updated_at` | `INTEGER` | NO | - | - | 마지막 수정 시각이다. |
| `archived_at` | `INTEGER` | YES | `NULL` | - | 논리 삭제 시각이다. |

### 인덱스

| 인덱스 | 컬럼 | 종류 | 목적 |
|---|---|---|---|
| `idx_checklist_items_widget_order` | `widget_id`, `archived_at`, `sort_order` | 일반 | 활성 항목을 표시 순서대로 조회한다. |

## `checklist_daily_states`

각 체크리스트 항목의 한국 날짜별 체크 여부를 저장한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `item_id` | `TEXT` | NO | - | 복합 기본 키, `checklist_items.id` FK, `ON DELETE CASCADE` | 체크리스트 항목이다. |
| `business_date` | `TEXT` | NO | - | 복합 기본 키 | 한국 시간 기준 `YYYY-MM-DD` 날짜다. |
| `checked` | `INTEGER` | NO | - | `0` 또는 `1` | 해당 날짜의 체크 여부다. |
| `updated_at` | `INTEGER` | NO | - | - | 마지막 상태 변경 시각이다. |

### 인덱스

| 인덱스 | 컬럼 | 종류 | 목적 |
|---|---|---|---|
| `idx_checklist_daily_states_date` | `business_date` | 일반 | 날짜 기준 상태 조회를 지원한다. |

## `checklist_events`

상세보기에서 사용하는 체크리스트 활동 이력을 저장한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `id` | `TEXT` | NO | - | 기본 키 | 이벤트 ID다. |
| `widget_id` | `TEXT` | NO | - | `dashboard_widgets.id` FK, `ON DELETE CASCADE` | 이벤트 소유 체크리스트 프로그램이다. |
| `item_id` | `TEXT` | NO | - | `checklist_items.id` FK, `ON DELETE CASCADE` | 관련 체크리스트 항목이다. |
| `item_label` | `TEXT` | NO | - | - | 이벤트 발생 당시 기록한 항목 이름이다. |
| `previous_item_label` | `TEXT` | YES | `NULL` | 값이 있으면 길이 1~200자 | 이름 변경 전 항목 이름이다. |
| `action` | `TEXT` | NO | - | `added`, `renamed`, `deleted`, `checked`, `unchecked` | 이벤트 종류다. |
| `business_date` | `TEXT` | NO | - | - | 이벤트의 한국 날짜다. |
| `occurred_at` | `INTEGER` | NO | - | - | 이벤트 발생 시각이다. |

### 인덱스

| 인덱스 | 컬럼 | 종류 | 목적 |
|---|---|---|---|
| `idx_checklist_events_widget_time` | `widget_id`, `occurred_at`, `id` | 일반 | 프로그램별 최신순 이력 조회를 지원한다. |
| `idx_checklist_events_item` | `item_id` | 일반 | 항목 영구 삭제 시 종속 이력 탐색을 지원한다. |
| `idx_checklist_events_time` | `occurred_at` | 일반 | 보관 기한이 지난 이력 정리를 지원한다. |

## `checklist_settings`

계정 전체 체크리스트에 공통으로 적용하는 기록 보관 설정이다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `singleton_id` | `INTEGER` | NO | `1` | 기본 키, 값은 반드시 `1` | 단일 설정 행이다. |
| `retention_days` | `INTEGER` | YES | `NULL` | NULL 또는 1~3650 정수 | NULL이면 무기한 보관한다. |

마이그레이션은 `(1, NULL)`을 생성하며 기존 기록을 삭제하지 않는다.
데스크톱·모바일 체크리스트 상세 기록의 `기록 보관 설정`에서 소유자가 기간을
설정할 수 있다. `GET`/`PATCH /api/preferences/checklist`는
`{ settings: { retentionDays } }`를 반환하고 PATCH 본문은
`{ retentionDays: number | null }`이다. 소유자 인증과 쓰기 요청의 same-origin
검사를 적용한다.

유한한 기간을 설정하면 매일 `00:00 KST` 정기 작업이 오늘과 직전 지정 일수를
보존하고 그 경계보다 오래된 `checklist_daily_states`와 `checklist_events` 행을
같은 D1 batch에서 삭제한다. 예를 들어 9월 5일에 1일 설정이면 9월 4일 00시
이전 기록을 삭제한다. 날짜별 상태는 `business_date`, 변경 이력은 `occurred_at`을
기준으로 한다. 경계에 있는 행, 현재 항목 정의, 오늘의 체크 상태는 유지한다.
설정 저장은 기록을 즉시 삭제하지 않으며 다음 정기 작업부터 적용한다.
무기한으로 되돌려도 이미 삭제된 기록은 복원되지 않는다.

## `mobile_preferences`

계정 전체에서 공유하는 모바일 설정을 단일 고정 행으로 저장한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `singleton_id` | `INTEGER` | NO | `1` | 기본 키, 값은 반드시 `1` | 설정 행을 하나로 제한한다. |
| `wallpaper_entry_id` | `TEXT` | YES | `NULL` | `filesystem_entries.id` FK, `ON DELETE SET NULL` | 선택한 모바일 배경 이미지다. |

마이그레이션은 `(singleton_id = 1, wallpaper_entry_id = NULL)` 행을 기본으로 생성한다.

## `guest_access_settings`

게스트 접속 허용 여부를 계정 전체에서 공유하는 단일 고정 행으로 저장한다.
마스터 설정을 꺼도 `guest_publications`의 항목별 공개 선택은 보존된다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `singleton_id` | `INTEGER` | NO | `1` | 기본 키, 값은 반드시 `1` | 설정 행을 하나로 제한한다. |
| `enabled` | `INTEGER` | NO | `0` | `0` 또는 `1` | 게스트 접속 마스터 허용 여부다. |

마이그레이션은 `(singleton_id = 1, enabled = 0)` 행을 기본으로 생성한다.
게스트 API는 매 요청마다 이 설정과 항목별 공개 정책을 검사한다. 비로그인 공개
경로와 소유자 인증 경계는 [게스트 공개 문서](./GUEST_ACCESS.md)를 따른다.

## `guest_publications`

게스트에게 공개하도록 명시적으로 선택한 활성 파일 시스템 항목을 저장한다. 폴더
공개 시 실행 시점의 하위 트리를 개별 행으로 기록하므로 이후 추가된 항목은
자동으로 공개되지 않는다. 휴지통 이동 시 해당 하위 트리의 행을 같은 D1 batch에서
제거하고 복원 시 다시 만들지 않는다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `entry_id` | `TEXT` | NO | - | 기본 키, `filesystem_entries.id` FK, `ON DELETE CASCADE` | 공개 대상으로 선택한 파일·폴더·프로그램 문서다. |
| `published_at` | `INTEGER` | NO | - | - | 해당 항목을 공개 대상으로 등록한 시각이다. |

## `integration_image_profiles`

이미지 수신 API의 저장 위치와 파일명 정책을 정의한다. 인증 토큰과
Cloudflare Access audience 값은 이 테이블에 저장하지 않는다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `id` | `TEXT` | NO | - | 기본 키 | API 경로에 사용하는 변경 불가능한 프로필 slug다. |
| `display_name` | `TEXT` | NO | - | - | 사용자에게 표시하는 프로필 이름이다. |
| `root_id` | `TEXT` | NO | - | `system-desktop-root` 또는 `system-documents-root` | 저장 기준 루트다. 외래 키가 아니라 CHECK 계약 값이다. |
| `path_template` | `TEXT` | NO | - | - | 루트 기준 상대 디렉터리 템플릿이다. |
| `file_name_template` | `TEXT` | NO | - | - | 서버가 생성할 파일명 템플릿이다. |
| `enabled` | `INTEGER` | NO | `1` | `0` 또는 `1` | 업로드 엔드포인트 활성 여부다. |
| `created_at` | `INTEGER` | NO | - | - | 프로필 생성 시각이다. |
| `updated_at` | `INTEGER` | NO | - | - | 마지막 프로필 수정 시각이다. |

### 기본 프로필

| 필드 | 값 |
|---|---|
| `id` | `novelai` |
| `display_name` | `NovelAI` |
| `root_id` | `system-desktop-root` |
| `path_template` | `NovelAI/{yyyy-MM-dd}` |
| `file_name_template` | `{HH-mm-ss-SSS}_{uuid}.{ext}` |
| `enabled` | `1` |

## `integration_image_profile_content_types`

각 이미지 수신 프로필이 허용하는 이미지 MIME 집합을 저장한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `profile_id` | `TEXT` | NO | - | 복합 기본 키, `integration_image_profiles.id` FK, `ON DELETE CASCADE` | 소유 이미지 수신 프로필이다. |
| `content_type` | `TEXT` | NO | - | 복합 기본 키, 지원 이미지 MIME | 요청에 허용할 MIME 타입이다. |

### 지원 MIME 값

| 값 |
|---|
| `image/jpeg` |
| `image/png` |
| `image/gif` |
| `image/webp` |
| `image/avif` |
| `image/bmp` |

## `integration_image_upload_log_settings`

모든 이미지 수신 프로필에 공통으로 적용할 로그 보관 기간을 단일 고정 행으로
저장한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `singleton_id` | `INTEGER` | NO | `1` | 기본 키, 값은 반드시 `1` | 설정 행을 하나로 제한한다. |
| `retention_days` | `INTEGER` | NO | `30` | `1 <= retention_days <= 365` | 한국 날짜 경계 기준 보관 일수다. |

마이그레이션은 `(singleton_id = 1, retention_days = 30)` 행을 기본으로 생성한다.

## `integration_image_upload_logs`

인증을 통과해 이미지 수신 핸들러에 도달한 요청의 결과를 저장한다. 프로필이나
파일을 삭제해도 감사 이력을 유지할 수 있도록 외래 키를 두지 않는다. 원본 이미지
본문, 인증 정보, R2 객체 키는 저장하지 않는다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `id` | `TEXT` | NO | - | 기본 키 | 수신 기록 ID다. |
| `profile_id` | `TEXT` | YES | `NULL` | - | 유효한 형식으로 확인된 요청 프로필 ID다. 삭제된 프로필도 문자열로 보존한다. |
| `source_ip` | `TEXT` | YES | `NULL` | - | 유효한 경우 `CF-Connecting-IP`에서 읽은 송신 IPv4 또는 IPv6 주소다. |
| `outcome` | `TEXT` | NO | - | `success` 또는 `failure` | 요청 처리 결과다. |
| `content_type` | `TEXT` | YES | `NULL` | - | 정규화 가능한 경우 기록한 요청 MIME 타입이다. |
| `declared_size` | `INTEGER` | YES | `NULL` | `declared_size >= 0` | 검증 가능한 경우 기록한 `X-File-Size` 값이다. |
| `file_entry_id` | `TEXT` | YES | `NULL` | 성공 시 필수 | 성공 당시 생성된 파일 시스템 항목 ID다. 외래 키는 아니다. |
| `file_name` | `TEXT` | YES | `NULL` | 성공 시 필수 | 성공 당시 서버가 부여한 파일명이다. |
| `http_status` | `INTEGER` | NO | - | 100~599 | 요청 결과의 HTTP 상태 코드다. |
| `error_code` | `TEXT` | YES | `NULL` | 실패 시 필수 | 클라이언트에 공개해도 안전한 애플리케이션 오류 코드다. |
| `error_message` | `TEXT` | YES | `NULL` | 실패 시 필수 | 클라이언트에 공개해도 안전한 오류 메시지다. |
| `received_at` | `INTEGER` | NO | - | - | Worker가 요청 처리를 시작한 시각이다. |
| `duration_ms` | `INTEGER` | NO | - | `duration_ms >= 0` | 요청 처리에 걸린 밀리초다. |

`success` 행은 파일 ID·파일명이 필요하고 오류 정보가 없어야 한다. `failure` 행은
파일 정보가 없어야 하며 오류 코드·메시지가 필요하다. 설정된 1~365일의 한국 날짜
경계를 기준으로 조회하며, 매일 `00:00 KST` Cron Trigger가 경계보다 오래된 행과
그 송신 IP를 함께 삭제한다.

### 인덱스

| 인덱스 | 컬럼 | 종류 | 목적 |
|---|---|---|---|
| `idx_integration_image_upload_logs_time` | `received_at`, `id` | 일반 | 전체 기록의 최신순 커서 페이징과 보존 기한 정리를 지원한다. |
| `idx_integration_image_upload_logs_profile_time` | `profile_id`, `received_at`, `id` | 일반 | 프로필별 최신순 조회를 지원한다. |

## 마이그레이션 기준

최종 스키마는 [`migrations`](../migrations)의 변경 불가능한 SQL 파일을 기준으로 한다.
스키마를 변경할 때는 이미 적용된 마이그레이션을 수정하지 않고 새 마이그레이션을
추가한 뒤 이 문서를 함께 갱신한다.
