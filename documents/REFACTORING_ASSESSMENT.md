# computer-room 리팩터링 진단 및 견적

작성일: 2026-08-28
기준 커밋: `db017bb` (`feat: 모바일 배경화면과 탐색 기능 확장`)

## 1. 결론

현재 코드는 기능 규모에 비해 전체적인 계층 경계와 테스트 기반이 잘 유지되어 있다. 즉, 전면 재작성이나 대규모 아키텍처 교체가 필요한 상태는 아니다. 가장 큰 문제는 기능이 누적되면서 일부 조립 컴포넌트, 파일 시스템 어댑터, 통합 테스트가 다시 변경의 중심점으로 커졌다는 점이다.

권장 방향은 기존 구조를 유지하면서 다음 순서로 책임을 좁히는 것이다.

1. 테스트와 검증 도구를 먼저 정리해 안전망을 강화한다.
2. 클라이언트 HTTP 공통 처리와 지나치게 넓은 Gateway 계약을 분리한다.
3. 탐색기·데스크톱·모바일 셸의 상태 관리와 명령 실행을 렌더링에서 분리한다.
4. 서버의 파일 시스템 HTTP 라우트와 반복되는 경로·이름 정책을 통합한다.
5. 마지막에 필요할 경우 D1 파일 시스템 구현을 내부 어댑터 단위로 나눈다.

권장 범위의 예상 공수는 **1인 기준 11~16일**이다. 기능 추가를 멈추기 어렵다면 먼저 4~6일 규모의 부채 억제 작업만 수행해도 이후 변경 비용을 눈에 띄게 낮출 수 있다.

## 2. 조사 범위와 방법

`AGENTS.md`의 다음 원칙을 평가 기준으로 사용했다.

- client, domain, application, infrastructure, HTTP, constants, types 계층 분리
- domain의 순수성 및 application의 추상화 의존
- 기능별 디렉터리 구성과 desktop/mobile UI의 명확한 분리
- SOLID, 특히 단일 책임 원칙과 인터페이스 분리 원칙
- 안정적인 API·D1·R2 계약 유지
- 책임별 상수와 오류 처리의 일관성
- 테스트 구조, 마이그레이션 안전성, 번들 제한과 구조 검사 준수

정적 구조, 주요 의존 방향, 큰 파일의 실제 책임, 중복 처리, 테스트 집중도와 프로덕션 빌드 결과를 확인했다. 이번 문서는 리팩터링 견적을 위한 진단이며 보안 감사나 성능 부하 시험을 대체하지 않는다.

## 3. 현재 기준선

조사 시점의 대략적인 코드 규모는 다음과 같다.

| 영역 | 파일 수 | 코드 줄 수 |
|---|---:|---:|
| `src/client` | 193 | 19,237 |
| `src/application` | 19 | 2,194 |
| `src/infrastructure` | 15 | 1,892 |
| `src/http` | 19 | 1,219 |
| `src/types` | 32 | 1,188 |
| `src/constants` | 29 | 1,003 |
| `src/domain` | 17 | 995 |
| `src/index.ts` | 1 | 209 |
| 제품 코드 합계 | 325 | 27,937 |
| 테스트·지원 코드 | 52 | 약 9,906 |

검증 결과는 모두 통과했다.

- `npm run check`: 통과
- Worker 테스트: 22개 파일, 124개 테스트 통과
- 클라이언트 테스트: 21개 파일, 92개 테스트 통과
- 전체: 216개 테스트 통과
- `npm run build`: 통과
- Worker 번들: 약 200KB
- 현재 검사기가 측정하는 클라이언트 entry: 186,842바이트

구조 검사는 통과하지만 다음 6개 파일은 크기 예외 목록에 들어 있다.

| 파일 | 줄 수 | 판단 |
|---|---:|---|
| `src/client/components/desktop/desktop-shell.tsx` | 901 | 즉시 분리 권장 |
| `src/client/components/filesystem/documents-window.tsx` | 774 | 즉시 분리 권장 |
| `src/infrastructure/filesystem/d1-filesystem-repository.ts` | 591 | 테스트 보강 후 분리 |
| `src/client/components/filesystem/recycle-bin-window.tsx` | 405 | 탐색기 공통화와 함께 분리 |
| `test/client/integration/app.test.tsx` | 1,864 | 즉시 시나리오 분리 권장 |
| `test/http/integration/worker.integration.test.ts` | 1,642 | 즉시 기능별 분리 권장 |

## 4. 잘 유지되고 있는 부분

다음 영역은 현재 원칙과 잘 맞으므로 리팩터링 과정에서도 보존하는 편이 좋다.

- domain과 application에서 React, Cloudflare, D1, R2, HTTP 구현 의존성이 발견되지 않았다.
- application이 infrastructure를 직접 참조하지 않고 포트를 통해 접근한다.
- API 경로, HTTP 헤더·메서드, 상태값, 오류 코드, 페이지 제한이 대체로 상수화되어 있다.
- 위젯 정책, activity 메뉴, 저장소 분류, 정렬 방식 등은 데이터 기반 매핑을 적절히 사용한다.
- desktop/mobile 컴포넌트와 CSS가 명시적으로 분리되어 있다.
- 마이그레이션 파일은 불변 기준으로 검사되며 현재 10개 마이그레이션이 안전성 검사에 등록되어 있다.
- Cloudflare Access 사용자 인증, NovelAI Service Auth, same-origin 검사가 라우터에서 구분되어 있다.
- 주요 기능은 이미 지연 로딩되고 있으며 새 런타임 의존성을 늘리지 않고도 개선할 여지가 충분하다.

따라서 이번 정리는 새 아키텍처 도입보다 **현재 아키텍처를 끝까지 적용하는 작업**으로 보는 것이 적절하다.

## 5. 우선순위별 진단

### P1. 통합 테스트가 변경 안전성의 병목이다

`test/client/integration/app.test.tsx`와 `test/http/integration/worker.integration.test.ts`가 각각 대부분의 기능 시나리오와 준비 코드를 한 파일에 소유한다. 실패 위치 파악이 어렵고, 작은 기능 변경도 큰 테스트 파일의 충돌 가능성을 높인다.

클라이언트 통합 테스트 내부에는 큰 로컬 Fake 구현도 함께 들어 있다. 또한 `test/support/fakes.ts`는 여러 feature fake를 다시 내보내는 barrel 역할을 하며, 소유 모듈을 직접 import하라는 프로젝트 규칙과 맞지 않는다.

권장 변경:

- 클라이언트 테스트를 bootstrap, desktop, filesystem, media, widgets, mobile 시나리오로 분리
- Worker 통합 테스트를 filesystem, widgets, media, NovelAI, storage, mobile preferences로 분리
- 공통 Worker 호출 환경과 클라이언트 렌더 harness만 `test/support/<feature>`에 유지
- `test/support/fakes.ts`를 제거하고 각 테스트가 실제 feature fake를 직접 import
- 이후 리팩터링할 서비스와 어댑터의 집중 테스트를 먼저 추가

이 작업은 기능 변경보다 먼저 수행해야 한다. 이후 단계의 회귀 위험과 디버깅 시간을 줄이는 투자다.

### P1. 클라이언트 Gateway가 너무 넓고 HTTP 처리가 중복된다

`FilesystemGateway`는 조회, 정렬, 생성, 이동, 휴지통, 다운로드, 업로드 등 약 20개 메서드를 한 계약으로 제공한다. `DashboardGateway`도 세션, 위젯 생명주기, 레이아웃, 메모, 체크리스트를 함께 소유한다.

실제 소비자는 계약의 일부만 필요하다. 테스트에 `as unknown as ...Gateway` 캐스팅이 10곳 존재하는 것이 인터페이스 분리 필요성을 보여준다. 이는 테스트 편의 문제라기보다 소비자가 필요 이상의 계약에 결합되어 있다는 신호다.

동시에 여러 API 클라이언트가 다음 동작을 반복한다.

- `credentials` 설정
- 응답 JSON 파싱 실패 처리
- 공통 오류 envelope 해석
- `Error` 변환

일반 `ApiError`가 위젯용 `dashboard-api-client`에서 export되어 storage, platform, widget-file 클라이언트가 이를 import하는 소유권 역전도 있다.

권장 변경:

- 파일 시스템 포트를 directory query/sort, entry mutation, transfer, recycle bin, content URL로 분리
- 대시보드 포트를 session, widget lifecycle/layout, memo, checklist로 분리
- 기존 합성 Gateway는 composition root에서만 유지해 점진적으로 전환
- 공용 인증 fetch와 API 오류 변환을 `client/api/shared` 소유의 작은 transport로 이동
- feature API 클라이언트는 해당 응답 계약 검증만 담당
- 테스트의 강제 Gateway 캐스팅 제거를 완료 기준으로 설정

### P1. 데스크톱과 탐색기가 조립 컴포넌트 이상을 담당한다

`DesktopShell`은 화면 조립 외에도 다음 책임을 갖는다.

- 창과 앱 열기 및 미디어 라우팅
- 위젯 파일 상태 동기화와 저장·닫기 생명주기
- 바탕화면 업로드, 드래그, 묶음 파일 작업
- 컨텍스트 메뉴 명령 구성
- 대화상자와 알림 상태
- 시작 메뉴, 작업 표시줄, 창 레이어 연결

`useDesktopFilesystemController`가 이미 일부 책임을 분리했지만, 실제 파일 명령과 메뉴·대화상자 흐름이 셸에 많이 남아 있다.

`DocumentsWindow`도 탐색 이력, 페이징, 정렬, 선택, 업로드, 드롭, CRUD, 묶음 처리, 컨텍스트 메뉴, 대화상자, 렌더링을 한 파일에서 처리한다. `RecycleBinWindow`에는 조회·페이징·busy/error·선택·묶음 결과 처리의 유사한 코드가 다시 존재한다. 모바일 디렉터리와 배경화면 선택기도 별도의 페이징·오류 상태를 구현한다.

권장 변경:

- 공용 `useDirectoryExplorer` 또는 `usePaginatedDirectory`로 조회, 첫 페이지, 더 보기, revision, 정렬 후 재조회를 통합
- 탐색기와 휴지통 명령은 각각 controller hook으로 이동
- 메뉴 항목 생성은 상태와 명령을 입력받는 순수 builder로 분리
- `DesktopShell`에는 최상위 조립과 이벤트 연결만 유지
- 열린 창 렌더링, 전역 대화상자, 파일 시스템 명령을 별도 계층으로 분리
- desktop/mobile 렌더러는 계속 분리하되 폴더 상세 정보 행과 저장소 상태 조회 같은 view-model/hook은 공유

목표는 단순히 줄 수를 줄이는 것이 아니라 렌더링, I/O 상태, 도메인 명령의 변경 이유를 분리하는 것이다.

### P1. 실제 시작 번들을 현재 검사기가 과소 측정한다

현재 `scripts/check-client-bundle.mjs`는 HTML이 가리키는 entry 파일 크기만 확인한다. Vite manifest의 정적 import 그래프까지 합산하지 않으므로 사용자가 desktop 또는 mobile 인터페이스를 선택한 뒤 즉시 불러오는 청크는 제한에서 빠진다.

정적 import closure를 별도로 계산한 결과는 다음과 같다.

| 측정 대상 | 정적 JavaScript 크기 |
|---|---:|
| 공통 entry closure | 203,415바이트 (약 198.6KiB) |
| desktop 선택 후 startup closure | 517,187바이트 (약 505.1KiB) |
| mobile 선택 후 startup closure | 439,420바이트 (약 429.1KiB) |

desktop 경로는 문서에 명시한 500KiB 목표를 실제로는 소폭 초과하지만 현재 검사는 통과한다. 약 169KB인 공통 정적 청크에는 API 클라이언트와 함께 ReactMarkdown/remark 코드가 들어 있다. 메모 위젯과 모바일 위젯 activity가 정적으로 연결된 것이 주요 원인이다.

권장 변경:

- Vite manifest의 정적 import 그래프를 순회해 desktop/mobile startup closure를 별도로 측정
- 두 인터페이스 각각의 예산을 검사하고 초과 시 빌드 실패
- 메모 위젯과 모바일 메모·체크리스트 activity를 실제로 열 때 지연 로딩
- Markdown 렌더러를 메모를 사용하지 않는 초기 화면에서 제외

이는 새 의존성 없이 적용할 수 있고, 구조 개선이 실제 사용자 초기 로딩에도 도움이 되게 만든다.

### P2. 서버 파일 시스템 정책과 HTTP 라우팅에 반복이 있다

`FileApiHandler`는 레거시 파일 API, 원본 콘텐츠, 썸네일, 디렉터리와 엔트리, 정렬, 휴지통, 묶음 작업, 다운로드 manifest를 함께 처리한다. 위젯 HTTP 계층은 이미 route module 조합 형태로 나뉘어 있으므로 파일 시스템도 같은 방식을 적용할 수 있다.

application 계층에서는 활성 루트 검증과 사용 가능한 이름 계산이 여러 서비스에 반복된다.

- 활성 루트 검증: `FilesystemService`, `FileService`, `FilesystemPathService`, `RecycleBinService`, `WidgetLayoutService`
- 충돌 없는 이름 계산: `FileService`, `FilesystemService`, `RecycleBinService`, `WidgetLayoutService`, `WidgetFileService`

일부 코드는 엔트리 조회 후 두 루트에 대한 소속 여부를 개별 확인하고, 최근 서비스는 이미 `findEntryWithinRoots`를 사용한다. 의미가 같은 정책이 여러 경로로 구현되면 D1 호출 수와 오류 의미가 달라질 수 있다.

권장 변경:

- 파일 전송·콘텐츠, 디렉터리·엔트리, 휴지통, 다운로드 manifest route module로 분리
- 현재 URL, 메서드, 요청·응답 JSON을 유지하는 facade handler 구성
- 활성 루트 조회를 하나의 application policy/collaborator로 통일
- 이름 충돌 해소를 하나의 순수 domain/application 함수로 통일
- 위젯 파일 저장 책임을 `WidgetFileService`에 모으고 `WidgetLayoutService`는 hydrate, layout, open/close에 집중

### P2. D1 파일 시스템 구현은 테스트 보강 후 나누는 편이 안전하다

`D1FilesystemRepository`는 분리된 여러 포트를 구현하지만 한 concrete class 안에 조회, 변경, 바탕화면 순서, 휴지통 처리 메서드가 모여 있다. 591줄이라는 크기 자체보다 SQL 변경의 영향 범위와 트랜잭션 책임이 한 파일에 집중된 점이 문제다.

권장 변경:

- 공통 SQL 조각과 row mapper는 infrastructure 내부 구현으로 공유
- query, mutation, desktop-order, recycle-bin 어댑터로 분리
- transaction/batch 경계는 mutation 또는 recycle 어댑터가 계속 소유
- composition root에서 같은 D1 binding을 주입해 공개 포트와 동작을 유지

다만 이 작업은 통합 테스트 분리와 repository 집중 테스트를 먼저 마친 뒤 진행해야 한다. 현재 단계에서 줄 수만 보고 먼저 나누면 SQL 중복과 트랜잭션 경계 누락 위험이 더 크다.

### P2. 상수·타입 디렉터리가 다시 포화되고 있다

구조 제한인 디렉터리당 직접 파일 12개에 이미 도달한 곳이 네 곳이다.

- `src/types/widgets`: 12개
- `src/types/filesystem`: 12개
- `src/client/components/filesystem`: 12개
- `src/client/components/desktop`: 12개

`src/application/filesystem`도 11개로 한 칸만 남아 있다. 다음 기능 추가 시 임의적인 파일 병합이나 예외 등록을 유도할 수 있다.

권장 구조는 별도 대이동이 아니라 앞 단계의 책임 분리와 함께 점진적으로 적용한다.

```text
client/components/
  desktop/{shell,window,chrome}
  filesystem/{explorer,entries,dialogs,transfer}

application/filesystem/
  directory/
  entries/
  transfer/
  recycle/

types/filesystem/
  entries/
  directory/
  transfer/
  recycle/
  ports/

types/widgets/
  lifecycle/
  layout/
  content/
  checklist/
  ports/
```

`client/constants/shared/mobile.ts`는 layout, CSS 변수, asset, activity 정책, 문구, glyph, class name을 한 파일에 포함한다. `client/constants/filesystem/filesystem.ts`도 UI 문구, 업로드 정책, drag, selection, explorer ID, 파일 크기 단위를 함께 소유한다. 상수를 단순히 더 잘게 쪼개기보다 실제 소비 feature와 책임으로 이동해야 한다.

모바일 파일을 components/styles 아래에서만 명시적으로 구분하고 나머지는 가능한 한 feature 공용으로 둔다는 기존 결정은 유지하는 것이 맞다.

### P2. 오류 메시지 추출과 보상 작업 관측성을 통일할 필요가 있다

여러 파일에 `error instanceof Error ? error.message : fallback` 형태가 반복되고 로컬 `errorMessage` 함수도 다수 존재한다. 공용 `messageFromError(error, fallback)`를 두면 fallback 정책과 알 수 없는 오류 처리 방식이 일관된다.

또한 `FileService.uploadFile`의 R2/D1 보상 처리에서 `Promise.allSettled` 결과를 확인하지 않고 원래 오류를 다시 던진다. 외부 응답에 인프라 세부 정보를 노출하지 않는 것은 맞지만, 정리 실패까지 완전히 관측하지 않으면 고아 R2 객체나 메타데이터를 추적하기 어렵다.

권장 변경:

- 공용 오류 메시지 추출 유틸리티 도입
- 보상 실패는 원래 공개 오류를 유지하되 주입된 logger/observer에 비민감 정보만 기록
- 파일명, 객체 내용, 토큰, 인증 claim은 기록하지 않음

### P3. 설정과 import 일관성에 작은 부채가 있다

`tsconfig.client.json`의 include 목록에는 현재 존재하지 않는 과거 경로 11개가 남아 있다. 현재는 다른 파일의 transitive import 덕분에 검사가 통과하지만, 설정 자체가 실제 구조를 설명하지 못한다.

또한 제품 TypeScript에 alias 대신 상대 경로를 사용하는 import가 소수 남아 있고, `desktop-window-layer.tsx`에는 선언 아래쪽에 React import가 있다. 기능 오류는 아니지만 자동 검사로 막지 않으면 구조 개편 후 다시 늘어날 가능성이 높다.

권장 변경:

- client TypeScript include를 현재 feature 경로 또는 공통 base config로 교체
- 남은 제품 코드 상대 import를 alias로 정리
- CSS 조립 import는 의도적인 상대 경로 예외로 문서화 가능
- 경량 lint/import-order 검사를 검토하되 대규모 포맷 변경과 기능 리팩터링을 같은 커밋에 섞지 않음

## 6. 지금 나누지 않는 편이 좋은 부분

다음 파일이나 구조는 길이만으로 분리하지 않는 편이 낫다.

- `db/schema.ts`: 343줄이지만 순환 외래 키를 포함한 D1 스키마의 단일 기준점이다. 구체적인 성장 문제가 생기기 전에는 유지한다.
- `ApiRouter`: 인증 흐름과 handler 조합 책임이 작고 명확하다.
- discriminated union 기반 mobile activity 분기: 상태 의존성이 있는 단순 조립 분기이므로 억지 매핑보다 현재 switch가 읽기 쉽다.
- domain/application 경계와 현재 포트 패턴: 교체 대상이 아니라 확장할 기준이다.
- 기존 마이그레이션: 절대 합치거나 삭제하지 않고 이후 스키마 변경 시 새 파일만 추가한다.

이번 리팩터링에서는 API URL과 JSON, D1 스키마, R2 객체 키, 인증 정책, 화면 기능을 바꾸지 않는 것을 기본 계약으로 삼아야 한다.

## 7. 권장 실행 순서와 공수

아래 공수는 1인, 하루 6~7시간의 집중 개발을 기준으로 하며 관련 테스트, `npm run check`, 전체 테스트, 프로덕션 빌드와 일반적인 회귀 수정 시간을 포함한다. 원격 배포, 데이터 마이그레이션, 새 기능, 전체 기기 수동 테스트는 제외한다.

| 단계 | 범위 | 예상 공수 |
|---|---|---:|
| 1 | TypeScript 설정, import, fake barrel, 오류 유틸리티 등 검증 기반 정리 | 0.5~1일 |
| 2 | 클라이언트·Worker 대형 통합 테스트 분리 및 공용 harness 정리 | 2~3일 |
| 3 | 공용 HTTP transport와 좁은 Gateway 포트 도입 | 1.5~2.5일 |
| 4 | 실제 startup bundle 검사와 메모·위젯 지연 로딩 | 1~2일 |
| 5 | 공용 디렉터리 조회 훅, 탐색기·휴지통 controller 분리 | 2.5~4일 |
| 6 | DesktopShell, MobileShell, context menu 조립 책임 축소 | 2.5~4일 |
| 7 | 파일 시스템 HTTP route와 활성 루트·이름 정책 통합 | 2.5~4일 |
| 8 | 위젯 파일 생명주기 책임 통합 | 1~1.5일 |
| 9 | D1 파일 시스템 어댑터 내부 분리(선택) | 2~3일 |
| 10 | 구조 예외 목록 축소와 문서 최종 정리 | 0.5~1일 |

일부 디렉터리 이동과 상수·타입 분리는 위 단계에 포함되므로 별도 합산하지 않는다.

### 선택 가능한 범위

| 범위 | 내용 | 총 예상 공수 |
|---|---|---:|
| 최소 부채 억제 | 1~4단계 중심: 검증, 테스트, HTTP/Gateway, 번들 측정 | **4~6일** |
| 권장 정리 | 1~8단계: 주요 UI·서버 책임 분리까지 | **11~16일** |
| 전체 정리 | 권장 범위 + D1 어댑터 분리 + 넓은 수동 회귀 확인 | **14~20일** |

기능 개발을 병행하거나 중간에 계약 변경이 들어오면 15~20%의 여유를 추가하는 편이 안전하다.

## 8. 권장 커밋 단위

각 단계는 독립적으로 검증하고 Conventional Commit으로 남기는 것이 좋다.

1. `chore: 리팩터링 검증 기준과 타입 설정 정리`
2. `test: 클라이언트와 Worker 통합 시나리오 분리`
3. `refactor: 공용 API 전송 계층과 좁은 게이트웨이 도입`
4. `perf: 인터페이스별 시작 번들 측정과 위젯 지연 로딩`
5. `refactor: 탐색기 조회와 파일 작업 컨트롤러 분리`
6. `refactor: 데스크톱과 모바일 셸 조립 책임 축소`
7. `refactor: 파일 시스템 HTTP 라우트와 공용 정책 분리`
8. `refactor: 위젯 파일 생명주기 책임 통합`
9. `refactor: D1 파일 시스템 어댑터 분리`
10. `chore: 구조 예외 목록 축소`

각 커밋은 공개 계약을 바꾸지 않고 관련 테스트를 통과해야 한다. 단순 파일 이동과 동작 변경도 같은 커밋에 섞지 않는 편이 문제 추적에 유리하다.

## 9. 완료 기준

권장 정리가 끝났다고 판단할 수 있는 기준은 다음과 같다.

- 6개 구조 예외 파일을 2개 이하로 줄이고 남은 예외마다 구체적인 단일 책임 사유가 있음
- composition root를 제외한 소비자가 전체 `FilesystemGateway` 또는 `DashboardGateway`에 의존하지 않음
- 테스트에서 `as unknown as ...Gateway` 캐스팅이 없음
- 클라이언트·Worker 통합 테스트가 feature별 파일로 분리되고 공용 fixture가 소유 feature에 위치함
- desktop과 mobile의 실제 static startup closure가 각각 설정한 번들 예산 이내임
- 디렉터리 페이징·정렬·오류 상태가 desktop/mobile에서 하나의 공용 조회 책임을 사용함
- 활성 루트와 이름 충돌 정책이 각 서비스에서 중복 구현되지 않음
- 기존 API, D1 스키마, R2 객체 키, Access 인증 정책과 사용자 동작이 유지됨
- `npm run check`, `npm test`, `npm run build`, `git diff --check`가 통과함

## 10. 최종 권고

가장 효율적인 선택은 먼저 **최소 부채 억제 범위 4~6일**을 수행한 뒤 기능 개발 속도와 충돌 빈도를 다시 보는 것이다. 특히 대형 통합 테스트 분리, 좁은 Gateway, 실제 번들 그래프 검사는 이후 모든 리팩터링의 비용을 낮춘다.

그 다음에는 파일 수나 줄 수보다 변경 이유가 자주 겹치는 곳부터 정리해야 한다. 현재 기준으로는 `DocumentsWindow`와 `DesktopShell`, 파일 시스템 HTTP/application 정책이 그 대상이다. D1 어댑터 분리는 가장 위험도가 높으므로 반드시 마지막 선택 단계로 두는 것이 적절하다.
