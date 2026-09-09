# 개발 안내

[문서 목차로 돌아가기](./INDEX.md)

## 아키텍처

```text
src/
├─ client/          React UI, 브라우저 상태와 API 클라이언트
├─ domain/          플랫폼에 독립적인 핵심 규칙
├─ application/     유스케이스와 포트 조합
├─ types/           계약과 포트 인터페이스
├─ constants/       정책값, API 경로, 오류와 제한
├─ infrastructure/  D1, R2, Cloudflare Access 어댑터
├─ http/            요청 검증과 응답 변환
└─ index.ts         composition root
```

도메인은 React·Cloudflare·D1·R2·HTTP에 의존하지 않습니다. application은
구체 구현 대신 포트 인터페이스에 의존하며, composition root가 실제 어댑터를
조립합니다. 여러 책임을 가진 계층은 파일 시스템·프로그램·미디어·통합 등
기능별 하위 디렉터리로 구분합니다.

클라이언트의 데스크톱·모바일 구현은 `components`와 `styles`에서 명시적으로
분리합니다. API, 상태, 훅, 도메인, 상수와 타입은 기능별 공용 모듈을 우선
사용합니다. 두 화면의 CSS·JavaScript는 별도 청크로 지연 로딩됩니다.

데스크톱 글자 크기는 `shared/base.css`의 PC 전용 Luna 변수로 관리합니다.
기본 UI는 15px, 본문은 16px, 제목은 17px, 보조 문구는 13px이며 모바일과 분리합니다.

데스크톱 폼의 배경, 대화상자 버튼 간격과 드롭다운 스타일은
`src/client/styles/desktop/forms.css`에서 공통 관리합니다. `appearance: base-select`를
지원하는 브라우저에는 파란 메뉴 강조색과 선택 상자에 붙는 메뉴를 적용하며,
미지원 브라우저와 모바일은 기본 선택 메뉴를 사용합니다.

정적 한국어 UI 문구는 `src/client/content/ko`, 기술 상수는 각 기능의
`constants`에서 관리합니다. 전체 코드 변경 규칙은 [AGENTS.md](../AGENTS.md)를
참고하세요.

## 경로 별칭과 편집기

| 별칭 | 대상 |
| --- | --- |
| `@/*` | `src/*` |
| `@client/*` | `src/client/*` |
| `@test/*` | `test/*` |

별칭은 [tsconfig.base.json](../tsconfig.base.json)에서 공통 관리합니다.
`src/client/tsconfig.json`과 `test/client/tsconfig.json`은 VS Code가 클라이언트
코드를 올바른 TypeScript 프로젝트로 인식하기 위한 얇은 진입점입니다.
barrel 파일을 만들지 않고 소유 모듈을 직접 import합니다.

## 로컬 환경

설치·실행 명령은 [루트 README](../README.md#로컬-실행)를 참고하세요.
환경 파일은 [.dev.vars.example](../.dev.vars.example)을 기준으로 준비하고,
실제 자격 증명은 저장소에 넣지 않습니다.

- `ENVIRONMENT=development`와 `DEV_AUTH_BYPASS=true`는 로컬 개발용입니다.
- 인증 우회는 로컬 `localhost` 요청에만 허용됩니다.
- `npm run typegen`은 Worker 바인딩 타입을 생성합니다.
- `npm run db:migrate:local`은 로컬 D1에 마이그레이션을 적용합니다.
- 운영 바인딩과 Access 설정은 [배포 문서](./DEPLOYMENT.md)에서 관리합니다.

## 계약과 데이터

HTTP 라우트는 공용 exact-route 도우미와 `API_PATHS` 계열 상수를 사용합니다.
파일 전송은 `/api/filesystem/files` 경로를 기준으로 제공하며, 소유자 API는
Access 인증과 쓰기 요청의 same-origin 보호를 유지합니다.

폴더 계층·프로그램 문서와 파일 바이트의 역할은 [기능 안내](./FEATURES.md)에,
테이블·컬럼 명세는 [데이터베이스 문서](./DATABASE_SCHEMA.md)에 있습니다.
외부 이미지 연동과 게스트 API는 각각의 전용 문서를 기준으로 합니다.

## 검증

개발 검사는 Node.js 22.18 이상 22.x 또는 24.11 이상에서 실행합니다.
ESLint 10과 Babel 8 parser를 사용하며, TypeScript 7의 타입 검사는 기존 `tsc`가 담당합니다.

| 명령 | 검사 |
| --- | --- |
| `npm run check` | TypeScript, 마이그레이션 안전성, 구조, UI 콘텐츠·HTTP 라우트·의존 경계와 React 훅 |
| `npm run check:architecture` | domain/application의 직접 의존 방향 |
| `npm run check:hooks` | 클라이언트 전체의 훅 호출 규칙과 의존성 배열 |
| `npm test` | 전체 테스트 |
| `npm run build` | 프로덕션 빌드와 초기 클라이언트 번들 제한 |
| `git diff --check` | 공백 오류와 잘못된 패치 흔적 |

개별 검사 명령과 최신 실행 순서는 [package.json](../package.json)을 기준으로
합니다. 스키마 변경은 마이그레이션 회귀 테스트와 안전성 검사를 추가하며,
적용된 마이그레이션을 수정하지 않습니다.

의존 검사는 별칭과 상대 경로를 정규화하여 타입·런타임 import, 재수출,
동적 import와 require를 검사합니다. domain은 domain·constants·공용 types만,
application은 여기에 application을 더한 영역만 참조할 수 있습니다.
두 영역의 외부 패키지·Node 내장 모듈·생성된 Worker 타입·계산된 모듈 경로는 금지합니다.
조립 진입점의 infrastructure 참조는 허용하며, 전이 의존이나 전체 순환 검사는 하지 않습니다.

클라이언트에는 `rules-of-hooks`와 `exhaustive-deps`만 오류 수준으로 적용합니다.
검사를 우회하거나 의존성을 기계적으로 추가하지 않고, 실제 수명과 콜백 책임을 정리합니다.
검사 설정의 회귀 테스트는 Node의 `test:unit`에 포함됩니다.

예기치 않은 API 오류는 `event`·`errorType` 두 필드만 JSON 로그로 기록합니다.
원본 오류의 message·stack·cause·임의 속성과 요청 정보는 기록하지 않습니다.
예상된 `AppError`의 비기록 정책과 공개 HTTP 오류 계약은 유지합니다.

## 자정 정기 작업 확장

정기 작업은 플랫폼에 독립적인 `ScheduledJob` 계약을 구현하고
[Worker 조립부](../src/index.ts)의 `createScheduledJobs`에 등록합니다.
현재 모든 작업은 매일 00:00 KST에 함께 시작합니다.

`ScheduledJobDispatcher`는 각 작업에 같은 예정 시각을 전달하고 각각 별도의
백그라운드 작업으로 등록합니다. 동기·비동기 실패가 다른 작업의 등록과 실행을
막지 않도록 하며, 실패는 비밀 정보가 없는 `background_task_failed` 이벤트와
작업별 코드로 기록합니다.

현재 등록된 작업은 이미지 수신 로그 정리와 체크리스트 기록 정리입니다.
체크리스트는 기본 무기한 보관이며 소유자가 기간을 지정한 경우에만 과거 상태와
이력을 삭제합니다. 보관 경계와 API는 [DB 명세](./DATABASE_SCHEMA.md#checklist_settings)를
참고하세요. 이미지 수신 로그 보관 규칙은
[이미지 수신 API 문서](./IMAGE_UPLOAD_API.md), Cron 운영은
[배포 문서](./DEPLOYMENT.md)를 참고하세요.
