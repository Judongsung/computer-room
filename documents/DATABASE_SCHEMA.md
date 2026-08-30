# D1 데이터베이스 명세

이 문서는 `migrations/0000_superb_hitman.sql`부터
`migrations/0011_magical_mister_sinister.sql`까지 모든 마이그레이션을 적용한
최종 애플리케이션 스키마를 설명한다.

Wrangler가 관리하는 마이그레이션 이력 등의 내부 테이블은 제외한다.
애플리케이션이 직접 관리하는 테이블은 총 12개다.

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
| 파일 시스템 | `filesystem_entries` | 폴더·일반 파일·위젯 파일 계층을 저장한다. |
| 파일 시스템 | `desktop_entry_order` | 동적 바탕 화면 항목 순서를 저장한다. |
| 파일 시스템 | `filesystem_directory_preferences` | 폴더별 정렬 설정을 저장한다. |
| 위젯 | `dashboard_widgets` | 위젯 창 배치와 열림 상태를 저장한다. |
| 위젯 | `memo_widgets` | 메모 위젯의 마크다운 본문을 저장한다. |
| 체크리스트 | `checklist_items` | 일일 체크리스트 항목을 저장한다. |
| 체크리스트 | `checklist_daily_states` | 날짜별 체크 상태를 저장한다. |
| 체크리스트 | `checklist_events` | 체크리스트 변경 이력을 저장한다. |
| 모바일 | `mobile_preferences` | 계정 공용 모바일 설정을 저장한다. |
| 외부 연동 | `integration_image_profiles` | 이미지 수신 API 프로필을 저장한다. |
| 외부 연동 | `integration_image_profile_content_types` | 이미지 수신 프로필별 허용 MIME을 저장한다. |

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

integration_image_profiles
└── integration_image_profile_content_types.profile_id
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

운영체제와 유사한 파일 시스템 계층을 표현한다. 폴더, 일반 파일, 위젯 파일이
하나의 트리를 공유한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `id` | `TEXT` | NO | - | 기본 키 | 파일 시스템 항목 ID다. |
| `parent_id` | `TEXT` | YES | `NULL` | `filesystem_entries.id` FK, `ON DELETE CASCADE` | 부모 폴더다. 시스템 루트는 부모가 없다. |
| `kind` | `TEXT` | NO | - | `directory`, `file`, `widget` | 항목 종류다. |
| `name` | `TEXT` | NO | - | - | 사용자에게 표시하는 이름이다. |
| `name_key` | `TEXT` | NO | - | 활성 형제 이름 UNIQUE에 사용 | 대소문자를 무시한 이름 충돌 검사에 사용하는 정규화 키다. |
| `file_id` | `TEXT` | YES | `NULL` | UNIQUE, `files.id` FK, `ON DELETE CASCADE` | 일반 파일의 메타데이터 참조다. |
| `widget_id` | `TEXT` | YES | `NULL` | UNIQUE, `dashboard_widgets.id` FK, `ON DELETE CASCADE` | 위젯 파일의 위젯 참조다. |
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
| `filesystem_entries_widget_id_unique` | `widget_id` | UNIQUE | 하나의 위젯이 최대 한 위젯 파일에만 속하게 한다. |
| `uq_filesystem_entries_active_parent_name` | `parent_id`, `name_key` | `trashed_at IS NULL`인 행의 부분 UNIQUE | 활성 상태인 형제 항목의 이름 충돌을 막는다. |
| `idx_filesystem_entries_parent_kind_name` | `parent_id`, `kind`, `name_key` | 일반 | 폴더 목록과 이름순 조회를 지원한다. |
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
| `desktop_entry_order_sort_order_unique` | `sort_order` | UNIQUE | 두 항목이 같은 순서를 차지하지 못하게 한다. |
| `idx_desktop_entry_order_sort` | `sort_order` | 일반 | 정렬된 바탕 화면 조회를 지원한다. |

## `filesystem_directory_preferences`

각 폴더의 정렬 설정을 독립적으로 저장한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `directory_id` | `TEXT` | NO | - | 기본 키, `filesystem_entries.id` FK, `ON DELETE CASCADE` | 설정 대상 폴더다. |
| `sort_field` | `TEXT` | NO | - | `name`, `createdAt`, `updatedAt`, `type`, `size` | 선택한 정렬 필드다. |
| `sort_direction` | `TEXT` | NO | - | `ascending` 또는 `descending` | 선택한 정렬 방향이다. |

## `dashboard_widgets`

모든 위젯의 영속 창 배치, 쌓임 순서와 열림 상태를 저장한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `id` | `TEXT` | NO | - | 기본 키 | 위젯 ID다. |
| `type` | `TEXT` | NO | `'memo'` | 지원 위젯 타입 | 위젯 동작을 구분한다. |
| `position_x` | `INTEGER` | NO | - | `0 <= position_x <= 8192` | 데스크톱 X 위치다. 단위는 픽셀이다. |
| `position_y` | `INTEGER` | NO | - | `0 <= position_y <= 8192` | 데스크톱 Y 위치다. 단위는 픽셀이다. |
| `width` | `INTEGER` | NO | - | `0 < width <= 4096` | 창 너비다. 단위는 픽셀이다. |
| `height` | `INTEGER` | NO | - | `0 < height <= 2160` | 창 높이다. 단위는 픽셀이다. |
| `window_state` | `TEXT` | NO | `'normal'` | `normal`, `minimized`, `maximized` | 현재 창 상태다. |
| `restore_state` | `TEXT` | NO | `'normal'` | `normal` 또는 `maximized` | 최소화 해제 시 복원할 상태다. |
| `stack_order` | `INTEGER` | NO | - | `stack_order >= 0` | 위젯 창의 Z 순서다. |
| `is_open` | `INTEGER` | NO | `1` | `0` 또는 `1` | 위젯 창의 열림 여부다. |

### 지원 위젯 타입

| 값 | 의미 |
|---|---|
| `memo` | 마크다운 메모 위젯이다. |
| `daily-checklist` | 일일 체크리스트 위젯이다. |
| `storage-status` | 단일 저장소 상태 위젯이다. |
| `image-upload-profiles` | 단일 이미지 API 프로필 관리 위젯이다. |

### 인덱스

| 인덱스 | 컬럼 | 종류 | 목적 |
|---|---|---|---|
| `idx_dashboard_widgets_stack_order` | `stack_order` | 일반 | 안정적인 창 쌓임 순서 조회를 지원한다. |
| `uq_dashboard_widgets_storage_status` | `type` | `storage-status`에 대한 부분 UNIQUE | 저장소 상태 위젯을 하나만 허용한다. |
| `uq_dashboard_widgets_image_upload_profiles` | `type` | `image-upload-profiles`에 대한 부분 UNIQUE | 이미지 API 프로필 위젯을 하나만 허용한다. |

## `memo_widgets`

창 배치와 분리된 메모 전용 데이터를 저장한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `widget_id` | `TEXT` | NO | - | 기본 키, `dashboard_widgets.id` FK, `ON DELETE CASCADE` | 소유 메모 위젯이다. |
| `markdown` | `TEXT` | NO | `''` | - | 마크다운 원문이다. |
| `updated_at` | `INTEGER` | YES | `NULL` | - | 마지막 본문 수정 시각이다. |

## `checklist_items`

매일 재사용하는 체크리스트 항목 정의를 저장한다. UI의 삭제는
`archived_at`을 기록하는 방식이므로 과거 이력이 항목과 연결된 상태로 남는다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `id` | `TEXT` | NO | - | 기본 키 | 체크리스트 항목 ID다. |
| `widget_id` | `TEXT` | NO | - | `dashboard_widgets.id` FK, `ON DELETE CASCADE` | 소유 체크리스트 위젯이다. |
| `label` | `TEXT` | NO | - | 길이 1~200자 | 현재 항목 이름이다. |
| `sort_order` | `INTEGER` | NO | - | `sort_order >= 0` | 위젯 내 표시 순서다. |
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
| `widget_id` | `TEXT` | NO | - | `dashboard_widgets.id` FK, `ON DELETE CASCADE` | 이벤트 소유 체크리스트 위젯이다. |
| `item_id` | `TEXT` | NO | - | `checklist_items.id` FK, `ON DELETE CASCADE` | 관련 체크리스트 항목이다. |
| `item_label` | `TEXT` | NO | - | - | 이벤트 발생 당시 기록한 항목 이름이다. |
| `previous_item_label` | `TEXT` | YES | `NULL` | 값이 있으면 길이 1~200자 | 이름 변경 전 항목 이름이다. |
| `action` | `TEXT` | NO | - | `added`, `renamed`, `deleted`, `checked`, `unchecked` | 이벤트 종류다. |
| `business_date` | `TEXT` | NO | - | - | 이벤트의 한국 날짜다. |
| `occurred_at` | `INTEGER` | NO | - | - | 이벤트 발생 시각이다. |

### 인덱스

| 인덱스 | 컬럼 | 종류 | 목적 |
|---|---|---|---|
| `idx_checklist_events_widget_time` | `widget_id`, `occurred_at`, `id` | 일반 | 위젯별 최신순 이력 조회를 지원한다. |

## `mobile_preferences`

계정 전체에서 공유하는 모바일 설정을 단일 고정 행으로 저장한다.

| 컬럼 | 타입 | Nullable | 기본값 | 키·제약조건 | 설명 |
|---|---|---:|---|---|---|
| `singleton_id` | `INTEGER` | NO | `1` | 기본 키, 값은 반드시 `1` | 설정 행을 하나로 제한한다. |
| `wallpaper_entry_id` | `TEXT` | YES | `NULL` | `filesystem_entries.id` FK, `ON DELETE SET NULL` | 선택한 모바일 배경 이미지다. |

마이그레이션은 `(singleton_id = 1, wallpaper_entry_id = NULL)` 행을 기본으로 생성한다.

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

### 인덱스

| 인덱스 | 컬럼 | 종류 | 목적 |
|---|---|---|---|
| `idx_integration_image_profiles_enabled` | `enabled` | 일반 | 활성 프로필 필터링을 지원한다. |

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

## 마이그레이션 기준

최종 스키마는 [`migrations`](./migrations)의 변경 불가능한 SQL 파일을 기준으로 한다.
스키마를 변경할 때는 이미 적용된 마이그레이션을 수정하지 않고 새 마이그레이션을
추가한 뒤 이 문서를 함께 갱신한다.
