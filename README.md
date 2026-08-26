# computer-room

Cloudflare Access로 보호되는 1인용 가상 컴퓨터 홈입니다. 데스크톱에서는 Windows XP, 휴대폰에서는 초기 Android 스타일 UI를 제공하며 React 화면과 API는 Cloudflare Workers에서 실행됩니다. D1은 위젯 배치와 가상 파일 계층·메타데이터를 저장하고, 비공개 R2 버킷은 파일 바이트를 저장합니다.

## 현재 구현 범위

- Windows XP Luna 스타일의 데스크톱 홈 화면과 시작 메뉴·작업 표시줄
- 초기 Android 스타일의 휴대폰 홈 화면과 뒤로·홈·메뉴 탐색
- 휴대폰 홈의 내 문서·내 컴퓨터·휴지통 및 바탕 화면 파일·폴더·위젯 파일 표시
- 휴대폰에서 폴더 탐색, 이미지·영상 보기, 파일 다운로드와 저장소 상태 조회
- 휴대폰 로컬 메모·체크리스트 초안 및 D1 위젯 파일 저장·열기
- 마크다운 작성·미리보기·저장을 지원하는 메모 위젯
- 한국 날짜 기준으로 매일 체크 상태가 초기화되는 일일 체크리스트 위젯
- 체크 항목 추가·수정·삭제와 체크/체크 취소 로그 상세보기
- 겹침을 허용하는 픽셀 단위 자유 배치와 창 드래그·크기 변경
- 창 포커스·최소화·최대화·복원과 작업 표시줄 전환
- 바탕 화면·탐색기·휴지통·창·작업 표시줄·편집 영역을 아우르는 키보드 지원 XP 우클릭 메뉴
- 250ms 병합 자동 저장, 저장 오류 알림과 재시도
- 시작 메뉴 전원 버튼을 통한 Cloudflare Access 로그아웃
- D1 기반 창 위치·크기·상태·쌓임 순서, 메모, 체크 상태와 이벤트 로그 저장
- 바탕 화면의 내 문서·내 컴퓨터·휴지통 바로가기와 세션 단위 시스템 창 상태
- 폴더 탐색·생성, 파일 업로드·다운로드, 이름 변경·이동과 휴지통 이동
- 폴더마다 독립적으로 기억되는 이름·날짜·종류·크기 정렬 기준과 방향
- 여러 파일과 폴더 계층의 선택·드롭 업로드, 항목별 진행 상태와 부분 실패 안내
- 클릭·Ctrl·Shift·Ctrl+A·선택 사각형을 이용한 탐색기·바탕 화면·휴지통 다중 선택
- 바탕 화면·내 문서·하위 폴더 사이의 선택 항목 묶음 드래그 이동과 휴지통 묶음 복원
- 단일 파일 직접 다운로드와 여러 파일·폴더의 브라우저 스트리밍 ZIP 다운로드
- 휴지통 복원·영구 삭제·전체 비우기와 XP형 확인 대화상자
- 내 컴퓨터에서 메모·일일 체크리스트·저장소 상태 위젯 실행
- R2 전체 객체와 D1 상태를 수동 측정하는 영속 단일 저장소 상태 위젯
- D1 기반 위젯 파일 저장, 닫기·다시 열기와 휴지통 수명주기
- 내 문서의 이미지·영상 파일을 독립된 XP 스타일 창으로 열기
- 이미지 확대·축소·창 맞춤·회전·이전·다음 탐색과 영상 재생 제어
- 탐색기·바탕화면·휴지통 이미지 썸네일의 지연 생성과 비공개 R2 캐시
- Worker를 통한 비공개 R2 미디어 스트리밍과 단일 HTTP Range 요청 지원
- 기존 `/api/files` 목록·업로드·다운로드 경로 호환 유지
- Access Service Auth로 보호되는 NovelAI 이미지 자동 저장 수신 API

데스크톱 UI는 1024×640 이상을 대상으로 하며, 정밀 포인터가 없는 767px 이하 휴대폰 화면에서는 모바일 UI를 사용합니다. 모바일 파일 시스템은 현재 탐색·보기·다운로드 전용으로, 업로드·이동·이름 변경·휴지통 복원 같은 관리 작업은 데스크톱에서 수행해야 합니다. 데스크톱에서 열어 둔 위젯 창은 모바일 시작 시 자동으로 열지 않습니다. 모바일에서 새 메모나 체크리스트를 만들면 한 개의 초안을 브라우저 로컬 저장소에 보관하며 로그아웃 후에도 유지되고, `파일로 저장`할 때만 D1 위젯 파일이 됩니다.

폴더와 휴지통은 페이지당 100개씩 불러오며 데스크톱의 Ctrl+A는 현재까지 불러온 항목만 선택합니다. 폴더 정렬 설정은 탐색기 폴더마다 D1에 저장되지만 바탕 화면 아이콘의 수동 배치 순서에는 영향을 주지 않습니다. 폴더 드롭은 브라우저의 디렉터리 드롭 API가 없으면 일반 파일 업로드로 제한됩니다. 여러 파일이나 폴더의 ZIP 다운로드는 최신 데스크톱 Edge·Chrome의 File System Access API가 필요하고 다운로드가 끝날 때까지 페이지를 열어 둬야 합니다. 문서 미리보기·파일 내용 편집, 검색과 공유 링크는 지원하지 않습니다. 위젯 파일은 ZIP에서 제외되며 D1에만 저장되고, 일반 파일의 바이트만 비공개 R2 버킷에 저장됩니다.

저장소 상태 위젯은 열 때와 사용자가 새로 고칠 때만 `GET /api/storage/status`를 호출합니다. 이 API는 비공개 R2 객체를 커서가 끝날 때까지 순회해 현재 바이트와 객체 수를 집계하므로 일반 레이아웃 저장이나 위젯 목록 조회에서는 실행되지 않습니다. [R2 가격 정책](https://developers.cloudflare.com/r2/pricing/)의 10 GB-month와 [D1 제한](https://developers.cloudflare.com/d1/platform/limits/)의 데이터베이스당 500 MB 표시는 현재 스냅샷을 비교하는 참고치이며 월 청구량이나 정확한 잔여 무료량을 뜻하지 않습니다.

## 미디어 뷰어 지원 형식

| 종류 | 지원 확장자 | 허용 MIME 타입 |
| --- | --- | --- |
| 이미지 | `.jpg`, `.jpeg`, `.jfif`, `.png`, `.gif`, `.webp`, `.avif`, `.bmp` | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif`, `image/bmp` |
| 영상 | `.mp4`, `.webm`, `.ogg`, `.ogv` | `video/mp4`, `video/webm`, `video/ogg` |

뷰어 지원 여부는 파일명보다 업로드 시 저장된 MIME 타입으로 판단합니다. 같은 확장자라도 MIME 타입이 다르면 다운로드 안내가 표시될 수 있으며, 영상의 실제 재생 가능 여부는 브라우저가 해당 컨테이너와 코덱 조합을 지원하는지에 따라 달라집니다. SVG는 실행 가능한 내용을 포함할 수 있어 인라인 뷰어에서 지원하지 않습니다.

JPEG, PNG, GIF, WebP 이미지는 목록에 처음 표시될 때 Cloudflare Images로 최대 96×96px 정적 WebP 썸네일을 생성하고 비공개 R2에 캐시합니다. GIF와 애니메이션 WebP는 첫 프레임만 사용합니다. Cloudflare Images 바인딩 입력 제한을 넘는 20MB 초과 이미지와 BMP, 기본 계정에서 입력 변환이 보장되지 않는 AVIF는 일반 파일 아이콘으로 표시되며 원본 뷰어 동작은 유지됩니다.

## NovelAI 이미지 수신 API

`POST /api/integrations/novelai/images`는 이미지 한 장의 원본 바이트를 받아 `바탕 화면/NovelAI/YYYY-MM-DD`에 저장합니다. 날짜와 `HH-mm-ss-SSS_<UUID>.<확장자>` 파일명은 서버 수신 시각의 한국 시간을 기준으로 생성됩니다. 같은 이미지를 여러 번 보내면 요청마다 새 파일로 저장됩니다.

```sh
curl --request POST "https://<computer-room-domain>/api/integrations/novelai/images" \
  --header "CF-Access-Client-Id: <CLIENT_ID>" \
  --header "CF-Access-Client-Secret: <CLIENT_SECRET>" \
  --header "Content-Type: image/png" \
  --header "X-File-Size: <BYTE_LENGTH>" \
  --data-binary "@generated.png"
```

지원 MIME 타입은 위 미디어 뷰어 표의 이미지 형식과 같습니다. 파일당 최대 크기는 100MB이며 본문은 multipart나 Base64가 아닌 이미지 바이너리여야 합니다. 성공하면 `201`과 `{ "file": FilesystemFileEntry }`를 반환합니다. 일반 웹 CORS는 허용하지 않으며 향후 브라우저 확장 프로그램은 host permission을 가진 background service worker에서 호출합니다.

Cloudflare Zero Trust에서 이 엔드포인트를 사용하려면 다음 설정이 필요합니다.

1. 전용 [Access 서비스 토큰](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)을 생성합니다.
2. computer-room 호스트의 정확한 `/api/integrations/novelai/images` 경로에 별도 Self-hosted Access 애플리케이션을 만듭니다. [Access 애플리케이션 경로 우선순위](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)도 함께 확인합니다.
3. 해당 애플리케이션에는 지정 토큰만 포함하는 `Service Auth` 정책을 연결하고, 인증 실패 응답을 `401`로 설정합니다.
4. 애플리케이션의 AUD 값을 `npx wrangler secret put NOVELAI_UPLOAD_POLICY_AUD`로 Worker에 설정합니다.

더 구체적인 Access 경로가 호스트 전체의 사용자 로그인 정책보다 우선합니다. 서비스 토큰의 Client ID와 Secret은 이 저장소나 확장 프로그램 소스에 넣지 않습니다.

## 구조

- `src/client`: React 화면, UI 상태, 브라우저 API 어댑터. UI 구현은 `components/desktop`·`components/mobile`과 `styles/desktop`·`styles/mobile`에서 명확히 분리하고, API·상태·훅·도메인·타입은 기능별 공용 모듈을 우선 재사용합니다. 실제로 모바일에만 필요한 항목만 이름이 명확한 전용 모듈에 둡니다.
- `src/domain`: 위젯 배치와 파일 규칙처럼 플랫폼에 의존하지 않는 순수 핵심 로직. 기능별 하위 디렉터리를 사용합니다.
- `src/application`: 파일 시스템·위젯·통합·저장소 유스케이스와 이들이 의존하는 포트 조합
- `src/constants`: 조정 가능한 정책값과 API·인증·HTTP 계약, 기능별 오류 카탈로그
- `src/types`: 기능별 도메인 모델과 조회·변경·저장소 포트 인터페이스
- `src/infrastructure`: D1, R2, Cloudflare Access 구현체. 구체 구현은 이 계층 밖으로 노출하지 않습니다.
- `src/http`: 기능별 요청 검증, 라우팅, 응답 직렬화
- `src/index.ts`: 구체 구현을 조립하는 composition root
- `test`: 소스 계층과 기능 구조를 미러링하며 공용 fixture와 fake는 `test/support/<feature>`에 둡니다.

소스 import는 `@/*`(`src/*`), `@client/*`(`src/client/*`), `@test/*`(`test/*`) 별칭을 사용하고 실제 소유 모듈을 직접 가리킵니다. 기능을 묶기 위한 barrel `index.ts`는 만들지 않습니다. 데스크톱과 모바일 애플리케이션은 서로 다른 CSS·JavaScript 청크로 지연 로딩되며, 데스크톱의 탐색기·휴지통·내 컴퓨터·미디어 뷰어·저장소 상태 위젯도 초기 화면과 별도 청크로 분리됩니다.

페이지 크기, 창 기본 크기, 자동 저장 간격, 파일 제한처럼 운영 중 조정할 수 있는 값은 사용처 수와 관계없이 `constants`에 둡니다. 변경 가능성이 없고 한 모듈에만 속하는 정규식·DOM 선택자 같은 구현 상수는 사용 위치 가까이에 둡니다.

오류 코드는 `constants/errors`에서 책임별로 코드·메시지·HTTP 상태를 함께 관리합니다. 서비스와 HTTP 계층은 구체 저장소 대신 역할별 인터페이스에 의존하므로 D1·R2 구현이나 UI 라이브러리를 다른 구현으로 교체할 수 있습니다. `react-rnd`는 데스크톱 창 어댑터에만 격리했고, 창 전환 규칙은 React와 분리된 순수 로직으로 관리합니다. 메모 마크다운은 raw HTML을 실행하지 않으며, 체크리스트의 날짜와 다음 초기화 시각은 서버가 한국 시간을 기준으로 결정합니다.

Windows XP 시각 자산의 출처와 라이선스는 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)에 기록했습니다.

## 로컬 실행

```sh
npm install
npm run typegen
npm run db:migrate:local
npm run dev
```

로컬에서만 `.dev.vars`의 인증 우회를 사용합니다. 필요한 키는 [.dev.vars.example](./.dev.vars.example)을 참고하세요. 배포 환경에서는 일반 API에 Cloudflare Access JWT와 소유자 이메일을 모두 검증하고, NovelAI 수신 API에는 별도 Access 애플리케이션의 JWT와 AUD를 검증합니다.

## 배포

1. `wrangler login`으로 사용할 Cloudflare 계정에 로그인합니다.
2. `wrangler.jsonc`의 D1·R2 바인딩이 생성한 저장소를 가리키고 `IMAGES` 바인딩을 사용할 수 있는 계정인지 확인합니다.
3. `npm run deploy`를 실행합니다. 타입·마이그레이션 안전성·테스트·프로덕션 빌드를 검증하고, D1 Time Travel 복구 지점을 기록한 다음 원격 마이그레이션과 Worker 배포를 순서대로 수행합니다.
4. 배포 주소 전체를 Cloudflare Access로 보호하고 본인 계정만 허용합니다.
5. Worker 환경 변수 `TEAM_DOMAIN`, `POLICY_AUD`, `OWNER_EMAIL`을 설정합니다.
6. R2의 `r2.dev` 공개 접근은 활성화하지 않습니다.

배포 직전의 D1 북마크는 Git에 포함되지 않는 `.wrangler/deploy-bookmarks`에 저장됩니다. 데이터 이상이 발생하면 해당 파일의 `bookmark` 값으로 `npx wrangler d1 time-travel restore computer-room-db --bookmark <bookmark>`를 실행할 수 있습니다. 복원은 원격 DB를 변경하므로 북마크의 시각과 영향을 확인한 뒤 수동으로 실행합니다. 자세한 동작은 [Cloudflare D1 Time Travel 문서](https://developers.cloudflare.com/d1/reference/time-travel/)를 참고하세요.

DB 변경이 없고 코드만 의도적으로 다시 배포할 때만 `npm run deploy:worker`를 사용합니다.

## 마이그레이션 안전 규칙

- 원격에 적용된 마이그레이션은 수정하거나 삭제하지 않고 새 파일로 변경을 추가합니다.
- D1 마이그레이션에서 `PRAGMA foreign_keys=OFF`에 의존하지 않습니다. 외래 키로 참조되는 테이블을 재생성할 때는 자식 행을 명시적으로 보존하고 회귀 테스트를 추가합니다.
- 새 마이그레이션의 `DROP TABLE`은 데이터 보존을 검토한 뒤 SQL에 `-- migration-safety: allow-table-drop <table>` 주석을 명시해야 합니다.
- 새 SQL을 검토한 뒤 `npm run db:migration:accept`로 해시를 등록합니다. 이후 해당 파일을 수정하거나 삭제하면 검사가 실패합니다.
- `npm run check:migrations`는 등록된 SQL의 해시와 새 SQL의 위험 패턴을 검사하며 기본 `check`와 `deploy`에 포함됩니다.

## 검증

```sh
npm run check
npm test
npm run build
git diff --check
```

`npm run check`에는 `check:structure`가 포함됩니다. 한 디렉터리의 직접 TypeScript·TSX·CSS 파일은 최대 12개이며, 제품 파일 400줄과 테스트 파일 600줄을 넘으면 책임 재검토 또는 이유가 적힌 allowlist가 필요합니다. `npm run build`는 빌드 후 초기 클라이언트 entry JavaScript가 500KiB 이하인지 `check:bundle`로 확인합니다.
