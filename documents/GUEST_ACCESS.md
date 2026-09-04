# 게스트 공개와 Access 설정

[문서 목차로 돌아가기](./INDEX.md)

## 공개 규칙

데스크톱의 `관리자` 프로그램에서 게스트 접속 허용 여부와 바탕 화면·내 문서
항목의 공개 상태를 관리합니다. 게스트 접속은 기본 비활성화이며, 마스터
설정을 꺼도 항목별 공개 선택은 보존됩니다.

- 일반 파일, 폴더와 저장된 메모·체크리스트 프로그램 문서를 공개할 수 있습니다.
- 폴더를 공개하면 그 시점의 하위 항목만 함께 공개됩니다. 이후 추가되거나
  이동해 들어온 항목은 자동으로 공개되지 않습니다.
- 이름 변경과 활성 폴더 간 이동은 공개 상태를 유지합니다.
- 휴지통으로 보내면 하위 항목을 포함한 공개 기록을 제거합니다. 복원해도
  자동으로 다시 공개되지 않습니다.

게스트는 같은 배포 주소에서 XP 데스크톱 또는 Android 모바일 화면을 사용합니다.
공개 바탕 화면 항목과 고정된 `내 문서`만 표시하며 내 컴퓨터, 휴지통, 관리자와
파일이 없는 내장 프로그램은 노출하지 않습니다.

파일은 보기·단일 다운로드, 폴더는 탐색, 프로그램 문서는 읽기만 허용합니다.
체크리스트 로그와 소유자의 창 배치는 공개하지 않습니다.

비공개 상위 폴더 아래의 항목을 공개하면 상위 폴더는 경로 탐색용 컨테이너로만
보입니다. 파일과 프로그램 문서는 `guest_publications`에 직접 등록된 항목만
열 수 있습니다.

## 관리 API

소유자 Cloudflare Access 인증을 사용하며 쓰기 요청에는 same-origin 검사를
적용합니다.

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| `GET` | `/api/admin/guest-access` | 마스터 설정 조회 |
| `PATCH` | `/api/admin/guest-access` | 마스터 설정 변경 |
| `GET` | `/api/admin/guest-access/directories/:id` | 폴더와 항목별 공개 상태 조회 |
| `PUT` | `/api/admin/guest-access/entries/:id` | 파일·폴더·프로그램 문서 공개 상태 변경 |

## 게스트 읽기 API

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| `GET` | `/api/guest/session` | 게스트 허용 상태와 소유자 로그인 경로 조회 |
| `GET` | `/api/guest/filesystem/directories/:id` | 공개 항목만 필터링한 폴더 조회 |
| `GET` | `/api/guest/files/:id/content` | 공개 파일 보기·Range 스트리밍 |
| `GET` | `/api/guest/files/:id/download` | 공개 파일 다운로드 |
| `GET` | `/api/guest/files/:id/thumbnail` | 공개 이미지 썸네일 조회 |
| `GET` | `/api/guest/program-documents/:id` | 공개 메모·현재 일일 체크리스트 조회 |

마스터 설정이 꺼져 있으면 세션 조회는 `{ enabled: false }`를 반환하고 나머지
게스트 리소스는 모두 `404`로 응답합니다. Worker는 요청마다 마스터 설정과
항목 공개 여부를 검증합니다.

게스트 응답에는 `private, no-store`와 same-origin 리소스 정책을 적용하며
일반 웹페이지용 CORS를 열지 않습니다.

## Cloudflare Access 경로

한 Worker와 같은 도메인을 유지하면서 정적 셸·게스트·소유자·이미지 수신 경로의
정책을 분리합니다. 더 구체적인 경로의 애플리케이션이 우선합니다.
[Access 경로 우선순위](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)

| 경로 | 정책 |
| --- | --- |
| `/*` | `Bypass` — 정적 앱 셸과 게스트 진입 허용 |
| `/api/*` | 소유자 이메일만 허용 |
| `/api/guest/*` | `Bypass` — Worker의 공개 정책과 요청 제한이 보호 |
| `/auth/login` | 소유자 이메일만 허용 |
| `/api/integrations/*/images` | 지정 서비스 토큰만 허용하는 `Service Auth` |

`Bypass` 경로에는 Access 인증과 접근 로그가 적용되지 않습니다. 공개 경로는
위 범위로 제한하고 소유자 API의 보호를 해제하지 않습니다.
[Access Bypass 정책](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/#bypass)

`/auth/login`은 인증 성공 후 `/?access=owner`로 돌아옵니다. 브라우저는 소유자
모드 힌트가 있을 때 보호된 `/api/session`을 조회하고, 로그아웃 시 힌트를
제거해 다음 접속을 게스트 모드로 시작합니다.

이미지 수신용 Service Auth의 설정과 기존 NovelAI 앱 전환은
[이미지 수신 API 문서](./IMAGE_UPLOAD_API.md)를 참고하세요.

## 요청 제한

현재 [Wrangler 설정](../wrangler.jsonc)의 Rate Limiting 바인딩은 다음과 같습니다.

| 바인딩 | namespace | IP 키별 제한 |
| --- | --- | --- |
| `GUEST_METADATA_RATE_LIMITER` | `31001` | 300회 / 60초 |
| `GUEST_BINARY_RATE_LIMITER` | `31002` | 120회 / 60초 |

초과 시 `429`와 `Retry-After: 60`, 바인딩 오류 시 `503`을 반환합니다.
namespace ID는 같은 계정의 다른 Rate Limiting 바인딩과 겹치지 않게 유지합니다.

이 제한은 Cloudflare 처리 위치별로 적용되는 완화된 제한이며 전 세계 요청을
합산하는 정확한 할당량은 아닙니다.
[Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
