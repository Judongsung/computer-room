# 소스코드 리팩토링 검토 보고서

[문서 목차](./INDEX.md)

작성일: 2026-09-07 (KST)

기준 커밋: `02aa1a17d85d957341f8e4c0a9884733980afd31`

범위: SOLID, 중복 제거, 비동기 상태, 조회 효율, 타입 계약, 오류 처리와 검증 도구

상태: **진단 완료 · 단계별 개선 진행 중 (R1 완료)**

## 1. 종합 판단

**전면 재작성보다 현재 아키텍처를 유지하는 국소 개선이 적절하다.** 서버 계층 분리, 클라이언트 포트, 기능별 테스트, 공통 HTTP 처리, 파일 시스템 정책의 기반은 잘 갖추어져 있다. 남은 문제는 일부 기능이 이 기반을 일관되게 사용하지 않는 데서 발생한다.

우선 처리할 부분은 체크리스트의 시간 기준과 모바일 조회·수정 충돌이다. 그다음 프로그램 데이터 조회 범위를 줄이고, 프로그램별 의존성과 반복된 화면 상태 처리를 정리하는 순서가 합리적이다. 파일 크기를 줄이거나 모든 분기를 전략 클래스로 바꾸는 작업은 우선순위가 낮다.

이 보고서는 현재 소스를 기준으로 새로 작성했다. [이전 진단](./REFACTORING_ASSESSMENT.md)은 2026-08-30에 완료된 작업의 이력으로 유지하며, 당시 해결한 문제를 현재 미해결 문제로 재분류하지 않는다.

## 2. 조사 범위와 신뢰도

전체 제품 소스의 파일 목록·크기·import 관계·반복 패턴을 조사한 뒤, 서버 유스케이스와 저장소 구현, 소유자·게스트 API, 데스크톱·모바일 프로그램, 파일 작업 훅, 관련 테스트와 검사 스크립트를 중심으로 본문을 읽었다. 모든 파일의 모든 실행 경로를 검증한 전수 동작 감사는 아니다.

줄 수는 빈 줄을 포함한 물리적 줄 수이며, 생성된 Worker 타입과 JSON 설정은 다음 집계에서 제외했다.

| 영역 | 파일 수 | 줄 수 |
| --- | ---: | ---: |
| client | 376 | 28,555 |
| application | 32 | 3,189 |
| domain | 23 | 1,407 |
| infrastructure | 32 | 3,303 |
| HTTP | 33 | 2,287 |
| types | 50 | 1,661 |
| constants | 43 | 1,423 |
| composition root | 1 | 343 |
| 합계 | 590 | 42,168 |

테스트 파일은 120개다. 제품 파일 최댓값은 `desktop-shell.tsx`의 367줄이며 구조 검사 예외 목록은 비어 있다. 이 수치는 책임이 모두 적절하다는 증거가 아니라, 이전의 대형 파일 집중 문제가 완화되었다는 기준선이다.

아래 진단 본문과 소스 행 번호는 기준 커밋 당시의 이력이다. **확인**은 진단 시 코드에 존재한 구조·분기·중복을 뜻한다. **조건부 위험**은 진단 시점에는 브라우저나 장애 주입으로 재현하지 않은 문제다. 이후 재현·해결 결과는 10절에 기록한다. 우선순위는 보안 심각도와 무관하다.

## 3. SOLID 평가

| 원칙 | 평가 | 근거와 방향 |
| --- | --- | --- |
| SRP: 단일 책임 | 대체로 양호, 일부 집중 | `WidgetLayoutService`가 창 생명주기와 프로그램 데이터 조립을 함께 소유한다. 파일 작업 controller에도 명령 실행·대화상자·선택·드롭이 모여 있다. 변경 이유가 같은 처리부터 분리한다. |
| OCP: 개방·폐쇄 | 적절한 매핑 기반, 개선 여지 | 프로그램 정책과 렌더러의 매핑은 좋은 기반이다. 새 프로그램 때문에 모든 기존 컴포넌트의 공통 props가 늘어나는 구조는 개선 대상이다. 새 종류 등록을 위한 명시적 수정 자체는 위반이 아니다. |
| LSP: 리스코프 치환 | 명백한 위반은 확인하지 못함 | 파일 서비스 데코레이터가 같은 전송 계약을 제공하며 기존 테스트도 있다. 상속 계층을 추가할 이유는 없다. 강제 캐스팅의 존재만으로 LSP 위반을 주장하지 않는다. |
| ISP: 인터페이스 분리 | 서버·훅에는 적용, UI 경계에 잔여 문제 | 작은 포트와 `Pick`을 사용하는 소비자가 있지만, `WidgetComponentProps`는 모든 프로그램의 gateway를 요구한다. 필요한 계약만 받도록 좁힌다. |
| DIP: 의존성 역전 | 서버 양호, 클라이언트 일부 예외 | domain/application의 직접 import 검색에서 React·client·HTTP·infrastructure 의존은 발견되지 않았다. 체크리스트 보관 설정 훅은 구체 API singleton에 직접 의존한다. |

import 조사는 문자열 기반이며 type import도 포함했다. 완전한 모듈 해석이나 런타임 순환 의존 검증을 대신하지 않는다.

## 4. 개선 항목 요약

| ID | 우선순위 | 항목 | 중심 관점 |
| --- | --- | --- | --- |
| R1 | P1 | 체크리스트 응답의 시각 기준과 데이터 조립 통일 — **완료 (1-A)** | 정확성, DRY |
| R2 | P1 | 모바일 프로그램의 조회·수정 충돌 방지 | 상태 일관성 |
| R3 | P2 | 프로그램 데이터 조회를 요청 ID 범위로 제한 | 성능, SRP |
| R4 | P2 | 프로그램별 props와 gateway 계약 분리 | ISP, OCP |
| R5 | P2 | 파일 변경 명령의 중복과 중복 실행 정책 정리 | DRY, SRP |
| R6 | P2 | 공통 화면 상태를 기능별 훅으로 공유 | DRY |
| R7 | P2 | 게스트 새로고침의 요청 순서와 부분 실패 처리 | 오류 처리 |
| R8 | P2 | 이미지 로그 훅의 의존성과 요청 수명 명시 | React 상태 관리 |
| R9 | P3 | 보관 설정 훅에 API 포트 주입 | DIP, 테스트 용이성 |
| R10 | P2 | 예기치 않은 API 오류의 로그 형식 통일 | 운영 관측, 정보 최소화 |
| R11 | P3 | 타입 순환과 과도한 제네릭 보장 축소 | 타입 계약 |
| R12 | P2 | 구조 검사를 실제 의존 방향과 훅 규칙까지 확장 | 재발 방지 |

P1은 관찰 가능한 동작의 일관성을 먼저 보강할 항목, P2는 다음 리팩토링에서 다룰 항목, P3는 관련 코드를 수정할 때 함께 처리할 항목이다.

## 5. 상세 진단

### R1. 체크리스트는 한 번 읽은 시각으로 응답 전체를 조립해야 한다

**완료: 2026-09-07, 단계 1-A.** 구현과 회귀 검증 결과는 10절 참조.

근거: [ChecklistService](../src/application/widgets/checklist-service.ts) 34–48행, [WidgetLayoutService](../src/application/widgets/widget-layout-service.ts) 219–279행, [GuestService](../src/application/guest/guest-service.ts) 125–146행.

**확인:** 세 경로 모두 `clock.now()`로 업무 날짜를 정하고, 저장소 조회를 기다린 뒤 `clock.now()`를 다시 읽어 `nextResetAt`을 계산한다. 체크 항목의 공개 DTO 변환도 각 경로에 반복된다. 레이아웃 경로는 같은 반복 설정을 `find()`로 두 번 찾는다.

**조건부 위험:** 일간 체크리스트를 KST 23:59:59에 조회하고 저장소 응답이 자정을 넘으면, 항목은 전날 상태인데 다음 초기화 시각은 그다음 자정인 응답을 만들 수 있다. 클라이언트가 이 시각으로 자동 갱신을 예약하므로 단순한 표시 차이보다 영향이 크다.

권장 변경은 조회 시작 시 `const now = clock.now()`를 한 번 정하고, 날짜·기간·응답 변환에 같은 값을 전달하는 것이다. 체크 항목 변환과 체크리스트 데이터 조립은 작은 순수 함수로 공유하되, 소유자 권한 확인과 게스트 공개 확인은 각각의 유스케이스에 남긴다. 반복 설정도 한 번 조회한 값을 사용한다.

완료 기준: 저장소 대기 중 시각이 자정을 넘는 fake를 사용해 `businessDate`, 체크 상태, `nextResetAt`이 같은 기간을 나타내는지 검증한다. 일간뿐 아니라 주간·월간 경계도 확인한다. 기존 [체크리스트 서비스 테스트](../test/application/widgets/checklist-service.test.ts)는 두 호출 사이에 시계를 바꾸는 시나리오여서 한 호출 안의 경계 통과를 검증하지 않는다.

### R2. 모바일 프로그램에도 조회와 수정의 충돌 방지 규칙이 필요하다

근거: [MobileWidgetFileScreen](../src/client/components/mobile/widgets/mobile-widget-file-screen.tsx) 38–53행과 96행 이후, [useDailyChecklistController](../src/client/hooks/widgets/checklist/use-daily-checklist-controller.ts) 37–68행, [useChecklistRefresh](../src/client/hooks/widgets/checklist/use-checklist-refresh.ts).

**확인:** 모바일의 `load()`는 응답이 오면 프로그램 전체를 `setWidget()`으로 교체한다. 동시에 체크 항목 추가·삭제·토글은 별도 콜백에서 상태를 갱신한다. 데스크톱 controller에 있는 `mutationInFlight`와 `mutationVersion` 방어가 모바일에는 없다. 자동 새로고침은 자정뿐 아니라 focus와 visibility 이벤트에서도 실행된다.

**조건부 위험:** 새로고침 요청 A가 시작된 뒤 체크 변경 B가 성공하고, A의 이전 상태가 늦게 도착하면 성공한 체크가 화면에서 되돌아갈 수 있다. 이 코드만으로 서버 데이터가 유실된다고 판단할 수는 없지만, 화면과 서버가 불일치할 수 있다.

권장 변경은 조회 세대와 수정 세대를 관리하는 체크리스트 공용 상태 계층을 두는 것이다. 데스크톱 편집 UI 상태까지 모바일에 끌어오기보다, 데이터 갱신·수정 명령·오래된 응답 무시 규칙을 공유한다. focus와 visibility가 연속 발생하는 경우 중복 조회도 합친다.

완료 기준: 지연 Promise로 A 시작 → B 성공 → A 완료 순서를 만들었을 때 B의 결과를 유지한다. 프로그램 ID 변경과 unmount 뒤의 응답도 반영하지 않는다. 기존 데스크톱 수정 동시성 테스트는 유지하고 모바일 회귀 시나리오를 추가한다.

### R3. 단일 프로그램 조회가 전체 프로그램 데이터를 읽는다

근거: [WidgetLayoutService](../src/application/widgets/widget-layout-service.ts) 219–310행, [D1MemoRepository](../src/infrastructure/widgets/d1-memo-repository.ts) 8–13행, [ChecklistService](../src/application/widgets/checklist-service.ts) 42행, [D1GuestPublicationRepository](../src/infrastructure/guest/d1-guest-publication-repository.ts)의 `checklistRepeatCycle()`.

**확인:** `hydrateOne()`은 단일 레이아웃을 `hydrate()`에 넘긴다. 그러나 메모는 `listAll()`, 체크리스트는 `listAllActiveItems()`로 읽는다. `listRepeatSettings()`는 요청한 레이아웃에 체크리스트가 없어도 호출된다. 소유자·게스트의 단일 체크리스트 조회도 모든 반복 설정을 읽고 하나를 찾는다.

저장한 프로그램 수와 메모 본문이 늘면 한 문서를 열 때도 전체 자료량에 비례해 조회·전송·메모리 비용이 증가한다. 실제 지연 시간과 운영 데이터 규모는 측정하지 않았다.

권장 변경은 `findByWidgetId` 또는 ID 목록을 받는 일괄 조회 포트를 도입하고, 여러 열린 창을 불러올 때도 필요한 ID만 읽는 것이다. 단일 조회를 고치면서 창마다 개별 쿼리를 보내는 N+1 구조로 바꾸지 않는다. 프로그램 데이터 조립을 별도 reader로 분리하면 `WidgetLayoutService`는 창 생성·열기·닫기·배치에 집중할 수 있다.

완료 기준: 무관한 메모·체크리스트를 많이 넣어도 대상 ID의 자료만 읽고 응답은 동일해야 한다. 빈 레이아웃이나 상태 없는 프로그램에서 체크리스트 쿼리를 하지 않아야 한다. 포트 변경 후 D1 구현과 fake를 함께 검증한다. 외부 API 형식과 스키마를 바꿀 필요는 없다.

### R4. 공통 프로그램 props가 모든 기능의 의존성을 전파한다

근거: [WidgetComponentProps](../src/client/types/desktop/desktop.ts) 88–98행, [WidgetRenderer](../src/client/components/widgets/widget-renderer.tsx), [MemoWidget](../src/client/components/widgets/memo-widget.tsx), [StorageStatusWidget](../src/client/components/widgets/storage-status-widget.tsx).

**확인:** 메모도 저장소·이미지 프로필·이미지 로그·게스트 관리 gateway를 필수 props로 받는다. 소비 함수가 일부 필드를 구조 분해하지 않아도 타입 계약과 테스트 준비에는 의존성이 남는다. 새 프로그램에 gateway를 추가하면 공통 props를 사용하는 기존 프로그램까지 영향을 받는다.

렌더러를 조립 경계로 삼아 프로그램별 좁은 props를 구성한다. 메모는 메모 변경 포트와 메모 타입, 저장소는 조회 포트와 창 컨트롤만 받도록 한다. `DashboardWidget` 전체를 받은 뒤 틀린 종류이면 `null`을 반환하는 방어도 구체 타입으로 줄일 수 있다.

모든 gateway를 선택 속성으로 바꾸거나 거대한 context에 숨기는 방식은 피한다. 기존 지연 로딩은 유지한다. 완료 기준은 메모·저장소 단독 테스트가 무관한 gateway fake 없이 컴파일되고, 새 프로그램 계약 추가가 기존 프로그램 props를 바꾸지 않는 것이다.

### R5. 파일 변경 명령의 중복이 실행 정책 차이로 이어진다

근거: [useDocumentsController](../src/client/hooks/filesystem/explorer/use-documents-controller.ts) 115–154행, [useDesktopFilesystemController](../src/client/hooks/desktop/filesystem/use-desktop-filesystem-controller.ts) 136행 및 245행 이후, [useRecycleBinController](../src/client/hooks/filesystem/recycle/use-recycle-bin-controller.ts) 67–108행.

**확인:** busy/error 설정, 성공 후 대화상자 닫기, 선택 갱신, revision 통지, batch 실패 표시가 반복된다. 휴지통에는 `mutationPending` ref로 즉시 중복 실행을 막는 방어가 있지만 탐색기의 `runChange`·`runBatchChange`에는 없다. 데스크톱도 별도 구현이다.

UI의 disabled 상태만으로 모든 호출 경로의 중복 실행이 차단된다고 가정하지 않는 편이 좋다. 공통 파일 변경 실행 훅은 중복 실행 정책과 busy/error 수명을 소유하고, batch 결과 적용은 작은 함수나 명시적 콜백으로 구성한다. 이동과 복원, 바탕화면 배치, 실패 항목 선택 같은 기능별 정책은 호출자에 남긴다.

완료 기준: 같은 명령을 렌더 사이에 연속 호출해도 정한 정책대로 한 번만 실행하거나 순차 실행한다. batch 일부 실패 시 성공 항목은 반영하고 실패 항목은 선택 상태와 오류 목록에 남긴다. 폴더 이동·휴지통 복원·프로그램 창 닫힘 회귀 테스트를 유지한다.

### R6. 화면은 분리하되 데이터와 편집 상태는 공유할 수 있다

근거: [데스크톱 저장소](../src/client/components/widgets/storage-status-widget.tsx) 44–65행 / [모바일 저장소](../src/client/components/mobile/widgets/mobile-storage-status.tsx) 17–33행, [데스크톱 메모](../src/client/components/widgets/memo-widget.tsx) / [모바일 메모](../src/client/components/mobile/widgets/mobile-memo.tsx), [디렉터리 페이지 훅](../src/client/hooks/filesystem/directory/use-paginated-directory.ts) / [휴지통 페이지 훅](../src/client/hooks/filesystem/recycle/use-paginated-trash.ts).

**확인:** 저장소의 load/status/loading/error와 메모의 draft/editing/dirty/save/error/취소 처리에 공통 부분이 있다. 저장소는 재조회 시작 시 오류를 지우는 시점도 화면마다 다르다. 두 페이지 훅은 요청 세대, 더 보기 잠금, 초기화와 실패 처리가 유사하다.

우선 `useStorageStatus`, `useMemoEditor`처럼 기능이 분명한 훅부터 공유한다. 모바일의 로컬 초안 저장과 데스크톱의 원격 저장은 주입한 저장 콜백으로 구분하고, 파일 저장·뒤로 가기·미리보기 표현은 각 화면에 남긴다.

페이지 훅 공통화는 후순위다. 공통 상태 처리만 추출할 수는 있지만 디렉터리 ID 확인·필터링과 휴지통 page 형식의 차이를 옵션 다수로 숨기면 오히려 유지보수가 어려워진다. 현재 두 구현은 요청 세대 방어와 테스트가 있으므로 줄 수만 줄이기 위한 통합은 필요 없다.

완료 기준: 저장 실패 후 초안 유지, 취소 후 원문 복구, 재조회 오류 상태가 두 화면에서 의도대로 유지된다. XP Luna와 초기 Android의 DOM·CSS 표현은 계속 분리한다.

### R7. 게스트 새로고침은 부분 실패와 오래된 응답을 구분해야 한다

근거: [useGuestProgramWindows](../src/client/hooks/guest/use-guest-program-windows.ts) 66–76행, [GuestMobileProgramDocument](../src/client/components/mobile/guest/guest-mobile-program-document.tsx) 26–47행.

**확인:** 데스크톱은 여러 체크리스트 창을 순차 갱신하며 성공할 때마다 전역 오류를 지운다. 앞 창이 실패해도 뒤 창이 성공하면 실패 표시가 사라진다. 모바일은 최초 조회에 `active` 방어가 있지만 refresh에는 같은 방어가 없고, 같은 문서의 중첩 새로고침에도 최신 요청 판정이 없다.

권장 변경은 문서·창별 요청 세대와 오류를 관리하고, 여러 창 갱신의 결과를 모아 오류를 한 번 결정하는 것이다. 모바일 초기 조회와 새로고침도 동일한 읽기 경로를 사용한다. 무조건 병렬화하기보다 먼저 오래된 결과와 부분 실패의 의미를 명확히 한다.

완료 기준: A 창 실패 + B 창 성공에도 A의 실패가 보인다. 새 요청 결과보다 늦게 도착한 이전 응답은 무시한다. 문서 변경·창 닫기 후 결과를 다시 반영하지 않는다. 게스트 읽기 전용과 서버의 요청별 공개 검사는 그대로 유지한다.

### R8. 이미지 로그 effect가 실제 의존성과 맞지 않는다

근거: [useImageUploadLogs](../src/client/hooks/integrations/use-image-upload-logs.ts) 22–54행, [useImageUploadLogSettings](../src/client/hooks/integrations/use-image-upload-log-settings.ts), [ImageUploadProfilesWidget](../src/client/components/widgets/image-upload-profiles-widget.tsx).

**확인:** 목록 effect는 `load(false)`를 사용하지만 의존성은 `enabled`, `outcome`, `profileId`뿐이다. `load`는 gateway·loading·cursor에도 의존한다. 따라서 `load`를 의존성에 그대로 추가하면 요청 상태 변경이 재조회를 일으킬 수 있고, 현재 구조에서는 gateway가 바뀌어도 그것만으로 재조회하지 않는다. disabled/unmount 시 요청 세대 무효화도 없다.

첫 페이지 조회와 다음 페이지 조회를 나누고, 첫 페이지 함수는 gateway와 필터처럼 조회 대상을 결정하는 값에만 의존하게 한다. cursor와 진행 중 여부는 더 보기 경로에서 관리한다. 탭이 비활성화되어도 응답을 캐시에 남길 것인지 무효화할 것인지 명시한다. 보관 설정의 읽기·저장 세대도 함께 점검한다.

완료 기준: 필터 변경 중 응답 역전, gateway 교체, 빠른 탭 전환, 더 보기 중 재조회에서 항목·cursor·loading 상태가 맞아야 한다. 단순히 의존성 경고를 억제하거나 배열에 `load`만 추가하는 변경은 완료로 보지 않는다.

### R9. 체크리스트 보관 설정의 구체 API 의존을 좁힌다

근거: [useChecklistRetention](../src/client/hooks/widgets/checklist/use-checklist-retention.ts) 4행 및 8행, [설정 API](../src/client/api/widgets/checklist-retention-api-client.ts), [설정 UI 테스트](../test/client/widgets/checklist-retention-settings.test.tsx).

**확인:** 다른 기능의 gateway 주입 패턴과 달리 이 훅은 `checklistRetentionApi`를 직접 호출한다. 테스트도 전역 `fetch`를 대체해야 한다. 동작 오류라고 볼 수는 없지만 상태 관리와 transport를 따로 검증하기 어렵다.

이미 있는 `ChecklistRetentionUseCases`의 조회·갱신 계약을 훅에 주입하고, 실제 API 연결은 컴포넌트 조립 경계에서 한다. 새 범용 저장소나 DI 프레임워크는 필요 없다. 완료 기준은 훅의 실패·저장·닫기 테스트가 좁은 fake로 가능하고, HTTP 응답 검증은 API 클라이언트 테스트가 맡는 것이다.

### R10. API 오류 로그에도 허용된 필드만 기록하는 정책을 적용한다

근거: [errorResponse](../src/http/shared/responses.ts) 39–46행, [보상 실패 observer](../src/infrastructure/filesystem/console-file-upload-compensation-observer.ts), [백그라운드 작업 scheduler](../src/infrastructure/platform/cloudflare-background-task-scheduler.ts).

**확인:** 공개 응답은 오류 정의로 변환하지만 예상하지 못한 오류는 `console.error(..., error)`로 원본 객체를 넘긴다. 보상·백그라운드 작업은 제한된 구조화 필드를 기록하므로 정책이 일관되지 않다.

**조건부 위험:** 구현 예외의 message/cause/custom property에 SQL·요청 값·파일 관련 값이 들어오면 로그에도 남을 수 있다. 실제 비밀 정보 유출을 확인한 것은 아니다.

오류 객체를 그대로 직렬화하는 대신 내부 오류 분류, 허용된 작업 코드, 필요한 상관 식별자만 기록하는 작은 reporter를 둔다. 요청 본문·원시 URL·헤더·임의 message/cause를 기록 필드에 추가하지 않는다. 원인을 추적할 분류 정보는 유지하고, 외부 응답 계약도 유지한다.

완료 기준: 민감한 문자열을 message/cause에 넣은 예외를 전달해도 로그와 HTTP 응답에 나타나지 않고, 정해진 오류 분류는 관찰할 수 있어야 한다.

### R11. 타입 순환과 실제보다 강한 타입 보장을 줄인다

근거: [desktop 타입](../src/client/types/desktop/desktop.ts), [filesystem 타입](../src/client/types/filesystem/filesystem.ts), [dashboard 타입](../src/client/types/widgets/dashboard.ts), [widget-data](../src/domain/widgets/widget-data.ts) 48–55행 및 106행 이후, [초안 factory](../src/application/widgets/widget-file-service.ts) 229행 이후, [D1 초안 저장소](../src/infrastructure/widgets/d1-widget-file-draft-repository.ts) 141행.

**확인:** 타입 import에 `filesystem ↔ desktop`, `desktop ↔ dashboard` 순환이 있다. 모두 타입 참조이므로 런타임 초기화 오류의 증거는 아니다. 하지만 창 기하 정보와 프로그램 props가 같은 파일에 모여 기능 간 결합을 만든다.

공용 창 상태·bounds 같은 독립 타입을 실제 소유 책임으로 분리하고 UI 조립 props는 소비 기능에 둔다. 전체 타입 디렉터리를 재배치할 필요는 없다.

또한 `cloneDashboardWidget<T>(widget: T): T`는 알려진 레이아웃·file·data 필드로 객체를 재구성하고 `as T`로 반환한다. 호출자가 추가 필드가 있는 하위 타입을 넘기면 그 필드는 사라질 수 있는데 반환 타입은 보존된다고 약속한다. 현재 호출에서 해당 문제가 발생한 것은 확인하지 못했지만 계약은 실제 구현보다 강하다. 필요한 종류별 반환 타입만 보장하거나 추가 필드 보존을 명시한다.

매핑의 `as unknown as`는 key와 payload 타입의 상관관계를 TypeScript가 끝까지 검증하지 못하는 지점이다. 제한된 helper와 타입 검증으로 보강하거나 두 종류뿐인 초안 분기는 exhaustive switch를 검토한다. 검증된 매핑을 무조건 없애는 작업은 권하지 않는다.

완료 기준: 타입 순환을 해소하고, 종류와 payload가 잘못 조합된 입력이 컴파일되지 않으며, clone의 실제 보존 범위와 반환 타입이 일치해야 한다.

### R12. 검사 통과가 아키텍처 경계까지 보장하도록 한다

근거: [package.json](../package.json), [구조 검사](../scripts/check-source-structure.mjs), [구조 정책](../scripts/constants/source-structure-policy.mjs), [테스트 분류](../test/support/platform/test-suites.ts).

**확인:** `check`는 TypeScript, 마이그레이션, 크기·파일 수, UI 문구 경계, HTTP 라우트 규칙을 검사한다. domain/application의 금지 import와 React Hooks 의존성을 직접 검사하는 단계는 없다. 따라서 R8 같은 상태 의존 문제도 현재 check를 통과한다.

구조 검사의 줄 수 규칙을 강화하기보다 import 방향과 훅 규칙을 보강한다. type-only와 런타임 의존을 구분하고, composition root의 infrastructure import는 허용한다. 훅 검사는 R8처럼 callback 구조를 먼저 정리하면서 적용한다. 도구 선택은 구현 시점에 결정하며 프로젝트 전체 포맷 변경과 섞지 않는다.

기존 Node/jsdom/Workers 테스트 분류는 유지한다. 테스트 수를 늘리는 것보다 R1의 호출 도중 자정 통과, R2·R7의 응답 역전, R5의 중복 명령, R10의 로그 내용처럼 관찰 가능한 계약에 회귀 테스트를 추가하는 것이 우선이다.

완료 기준: 금지 import·누락된 훅 의존성이 검사에서 잡히고, 의도된 조립부와 타입 참조는 불필요하게 차단하지 않는다. 예외가 필요하면 구체적인 이유를 기록한다.

## 6. 추가 검토 후보

다음은 실패 복구·운영 규모의 요구사항을 확인한 뒤 범위를 정할 항목이다. 본 진단만으로 모두 즉시 구현할 필요는 없다.

| 후보 | 코드 근거와 영향 | 다음 확인 |
| --- | --- | --- |
| 영구 삭제의 부분 실패 복구 | [RecycleBinService](../src/application/filesystem/recycle/recycle-bin-service.ts)의 `permanentlyDeleteEntry()`는 객체 삭제 후 메타데이터를 제거한다. 후자가 실패하면 내용이 없는 휴지통 항목이 남을 수 있다. | 객체 삭제 성공 → 메타데이터 실패 → 재시도·복원 시나리오를 검증하고, 삭제 진행 상태가 필요한지 결정한다. 순서를 뒤집기만 하면 고아 객체 문제가 생길 수 있다. |
| 업로드 작업 세션 | [useFilesystemUpload](../src/client/hooks/filesystem/use-filesystem-upload.ts)는 여러 파일 worker를 관리하지만 최상위 upload 호출들을 한 state에 반영한다. | UI 모달이 겹친 시작을 실제로 차단하는지 확인한다. 여러 호출을 지원한다면 세션 ID/큐를, 지원하지 않는다면 즉시 실행 잠금을 둔다. |
| 대형 트리 작업의 메모리 | [다운로드 manifest 서비스](../src/application/filesystem/filesystem-download-manifest-service.ts)는 하위 트리를 메모리에 모아 경로를 만들고 정렬한다. | 실제 최대 트리 크기와 실행 시간을 측정한 뒤 제한·분할 처리 여부를 결정한다. 이번 보고서에 추정 성능 수치를 넣지 않는다. |
| 조립부 가독성 | [src/index.ts](../src/index.ts)는 343줄의 명시적 조립부다. | 새로운 기능 조립이 더 늘 때만 파일 시스템·프로그램·게스트 factory로 나눈다. 현재 길이만으로 SRP 위반으로 분류하지 않는다. |

## 7. 유지할 구조와 피할 변경

- application의 추상화 의존, domain의 플랫폼 독립성, 기능별 소스·테스트 구성을 유지한다.
- 이미 도입된 `ActiveFilesystemEntryResolver`, `FilesystemNameAllocator`, HTTP route helper, API transport, 오류 메시지 유틸리티를 재사용한다.
- 프로그램 정책 매핑, 명확한 discriminated union 분기, 명시적 composition root를 범용 프레임워크로 대체하지 않는다.
- 소유자 인증·same-origin 검사와 게스트의 master setting·개별 공개 판정은 각각 유지한다. 응답 DTO 공유가 권한 정책 공유를 뜻하지는 않는다.
- XP Luna와 초기 Android UI는 유지한다. 공통 훅 추출을 명분으로 두 화면의 DOM·CSS를 통합하지 않는다.
- `widget` DB/API 명칭, URL·JSON, R2 키, 기존 마이그레이션을 보존한다. 권장 리팩토링의 대부분은 스키마 변경 없이 가능하다.
- 이미 개선된 초기 번들 검사는 정적 import 그래프를 합산한다. 이전 보고서의 entry-only 측정 문제를 현재 문제로 다시 지적하지 않는다.

## 8. 권장 실행 순서와 규모

### 합의한 단계별 진행표

각 단계는 구현 → 검증 → 완료 기록 → 커밋 → 결과 공유 순서로 진행한다.
다음 단계는 직전 결과를 바탕으로 계획하며, 배포와 원격 push는 포함하지 않는다.
추가 검토 후보 4개는 별도 범위 결정 전까지 구현하지 않는다.

| 단계 | 대상 | 작업 | 상태 |
| --- | --- | --- | --- |
| 1-A | R1 | 체크리스트 시각 기준과 응답 변환 통일 | **완료 · 2026-09-07** |
| 1-B | R2 | 모바일 조회·수정 충돌 방지 | 예정 |
| 1-C | R7 | 게스트 새로고침과 부분 실패 처리 | 예정 |
| 2 | R3 | 요청한 프로그램 ID 범위로 조회 제한 | 예정 |
| 3 | R4·R9·R11 | 프로그램별 인터페이스·API 주입·타입 계약 정리 | 예정 |
| 4 | R5·R6·R8 | 파일 명령과 화면 상태의 중복 제거 | 예정 |
| 5 | R10·R12 | 오류 로그와 자동 검사 보강 | 예정 |

상위 1단계 상태: **진행 중**. 1-A·1-B·1-C가 모두 끝나야 완료로 표시한다.
코드·테스트와 해당 단계의 완료 날짜, 변경 요약, 검증 결과, 남은 범위를 같은
커밋에 포함한다. 커밋 메시지는 한국어 Conventional Commit 형식을 사용한다.
문서에는 커밋 제목을 기록하고 실제 해시는 결과 공유에서 안내한다.

기준선 커밋: `docs(refactor): 리팩토링 진단과 단계별 진행 기준 기록`

### 진단 당시의 작업 규모

| 단계 | 작업 | 완료 조건 | 대략적 규모 |
| --- | --- | --- | --- |
| 1 | R1·R2·R7: 시간·비동기·부분 실패 | 경계 시각과 응답 역전 회귀 테스트 | 중간 |
| 2 | R3: 대상 ID 조회와 데이터 reader | 전체 데이터 조회 제거, API 동등성 | 중간 |
| 3 | R4·R9·R11: props·포트·타입 경계 | 무관한 fake 제거, 타입 계약 정합성 | 중간 |
| 4 | R5·R6·R8: 명령·화면 상태 공통화 | 중복 실행/필터 전환/초안 유지 검증 | 중간~큼 |
| 5 | R10·R12: 로그와 자동 검사 | 민감 문자열 비기록, 금지 의존 탐지 | 작음~중간 |

각 단계는 독립적으로 리뷰 가능한 변경으로 나눈다. 규모는 변경 범위의 상대 비교이며 확정 공수는 아니다. 특히 모든 화면 상태를 한 번에 통합하면 추상화 설계와 UI 회귀 확인 비용이 커진다. 비용 대비 효과만 고려하면 1·2단계를 먼저 적용하고 나머지는 관련 기능 변경과 함께 진행할 수 있다.

구현 시 공통 검증은 `npm run check`, 변경에 맞는 `test:unit`·`test:client`·`test:worker`, `git diff --check`다. 클라이언트 번들에 영향이 있으면 `npm run build`도 수행한다. 스키마 변경을 선택하는 후속 작업만 새 마이그레이션과 회귀 검증이 필요하다.

## 9. 최초 진단의 검증 결과와 한계

| 검증 | 결과 |
| --- | --- |
| `npm run check` | 통과: TypeScript 3개 설정, 불변 마이그레이션 17개, 구조·문구·라우트 검사 |
| `npm run test:unit` | 통과: 55개 파일, 247개 테스트 |
| 전체 파일/크기/import 패턴 조사 | 수행: 생성 타입 제외, 관련 본문과 교차 확인 |
| 문서 링크·내용·diff 검토 | 수행 |
| `git diff --check` 및 새 보고서 공백 검사 | 통과 |
| `test:client`, `test:worker` | 미실행: 이번 변경은 보고서와 목차뿐이며 UI·바인딩 동작을 수정하지 않음 |
| `npm run build` | 미실행: 번들 변경 없음. 기존 검사 구현만 읽었고 현재 번들 크기는 재측정하지 않음 |
| 브라우저 재현·운영 부하·장애 주입 | 미실행: 조건부 위험의 재현 절차는 각 항목에 제시 |

최초 진단에서는 제품 코드·설정·DB·배포 상태를 변경하지 않았다. 이 절의 단위 테스트 통과는 진단 당시 기준선이며 모든 조건부 위험이 없다는 증거는 아니다.

## 10. 단계별 완료 기록

### 1-A · R1: 체크리스트 시각 기준과 응답 변환 통일

- 완료일: **2026-09-07 (KST)**
- 커밋 제목: `fix(checklist): 조회 시각 기준과 응답 변환 통일`
- 단일 체크리스트 조회, 레이아웃 일괄 조회, 게스트 프로그램 조회는 데이터 조회 전에 시각을 한 번 캡처한다. 저장소 업무 날짜와 응답의 날짜·다음 초기화 시각을 이 값으로 계산한다.
- [공통 응답 변환](../src/application/widgets/checklist-data-mapper.ts)에 `toChecklistItem`과 `toChecklistData`를 추가하고 세 경로의 중복을 제거했다. 항목 순서, 기본 일간 반복, 체크 시각의 ISO 및 `null` 변환은 유지했다.
- 레이아웃의 반복 설정은 ID별 Map으로 구성하고 프로그램마다 한 번 찾는다.
- API·저장소 포트·DB 스키마·권한 판정·UI는 변경하지 않았다. 전체 데이터 조회 최적화는 R3에 남아 있다.

| 검증 | 결과 |
| --- | --- |
| 변경 전 재현 | 세 조회 경로 × 일간·주간·월간 경계 9개 테스트에서 잘못된 `nextResetAt`으로 실패 확인 |
| 추가 회귀 및 변환 테스트 | 18개 통과: 조회 도중 시각 변경, 다중 창의 동일 기준, 경계 전후, 기본 반복, 빈 목록, 항목 순서·체크 시각 |
| `npm run check` | 통과: TypeScript, 불변 마이그레이션 17개, 구조·문구·라우트 검사 |
| `npm run test:unit` | 58개 파일 · 265개 테스트 통과 |
| `npm run test:worker` | 24개 파일 · 83개 테스트 통과. 최초 실행의 파일 접근 경고를 해소하기 위해 로컬 실행 권한으로 재검증했고 동일하게 통과 |
| `git diff --check` 및 staged diff 검사 | 통과 |
| 클라이언트 테스트·빌드 | 미실행: 서버 application과 Node 테스트·문서만 변경했으며 클라이언트 번들 변경 없음 |

다음 구현 단위는 1-B(R2)의 모바일 조회·수정 충돌 방지다. R2·R7을 포함한 나머지 항목과 추가 검토 후보는 완료 처리하지 않았다. 배포와 원격 push는 수행하지 않았다.
