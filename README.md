# computer-room

Cloudflare Access로 보호되는 1인용 가상 컴퓨터 홈입니다.

- 데스크톱: Windows XP Luna 스타일
- 모바일: 초기 Android 스타일
- 구조화된 데이터: Cloudflare D1
- 비공개 파일: Cloudflare R2
- 화면과 API: Cloudflare Workers

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 언어 | TypeScript 7 |
| UI | React 19, React DOM, React Markdown |
| 스타일 | CSS, XP.css, react-rnd |
| 빌드 | Vite 8, Cloudflare Vite Plugin |
| 런타임 | Cloudflare Workers |
| 인증 | Cloudflare Access, Access Service Token |
| 데이터베이스 | Cloudflare D1, Drizzle ORM |
| 파일·이미지 | Cloudflare R2, Cloudflare Images |
| ZIP 다운로드 | client-zip, File System Access API |
| 테스트 | Vitest, Testing Library, Cloudflare Workers Vitest Pool |
| 배포·운영 | Wrangler 4, D1 Time Travel |

## 주요 기능

### 데스크톱

- 자유롭게 이동하고 크기를 조절할 수 있는 XP 스타일 창
- 창 포커스, 최소화, 최대화, 복원과 작업 표시줄 전환
- 시작 메뉴와 Cloudflare Access 로그아웃
- 바탕 화면, 탐색기, 휴지통, 창, 작업 표시줄을 지원하는 XP형 우클릭 메뉴
- 창 위치·크기·상태·쌓임 순서의 D1 저장과 250ms 병합 자동 저장

### 모바일

- 초기 Android 스타일 홈 화면과 뒤로·홈·메뉴 탐색
- 내 문서, 내 컴퓨터, 휴지통과 바탕 화면 항목 표시
- 폴더 탐색과 폴더별 상세 정보·정렬 설정
- 이미지 좌우 스와이프, 이미지·영상 보기, 파일 다운로드와 저장소 상태 확인
- 바탕 화면·내 문서의 기존 이미지를 사용하는 계정 공용 홈 배경화면
- 모바일 로컬 메모·체크리스트 초안 작성
- 로컬 초안을 D1 위젯 파일로 저장하고 다시 열기

모바일에서는 데스크톱에서 열어 둔 위젯 창을 자동으로 열지 않습니다. 새 위젯은 한 번에 하나의 로컬 초안으로 보관되며 로그아웃 후에도 유지됩니다. `파일로 저장`을 실행해야 D1에 위젯 파일이 생성됩니다.

### 위젯

- 마크다운 작성·미리보기·저장을 지원하는 메모
- 한국 날짜를 기준으로 체크 상태가 매일 초기화되는 일일 체크리스트
- 체크 항목 추가·수정·삭제와 체크 이력 조회
- R2와 D1의 현재 사용 상태를 확인하는 저장소 상태 위젯
- 저장 경로·파일명·허용 MIME을 관리하는 이미지 API 프로필 위젯
- D1 기반 위젯 파일 저장, 닫기, 다시 열기, 휴지통 이동과 복원

### 파일 시스템

- D1 기반 바탕 화면·내 문서·하위 폴더 계층
- 폴더 생성, 파일·폴더 업로드, 다운로드, 이름 변경과 이동
- 파일·폴더 드래그 앤 드롭과 여러 항목 선택
- 폴더별 이름·날짜·종류·크기 정렬 설정 저장
- 휴지통 이동, 복원, 영구 삭제와 전체 비우기
- 단일 파일 직접 다운로드와 여러 파일·폴더의 스트리밍 ZIP 다운로드
- `/api/filesystem/files` 기반 비공개 업로드·다운로드·미디어 전송 API

### 미디어

- 비공개 R2 이미지·영상 스트리밍
- 이미지 확대·축소, 창 맞춤, 회전과 이전·다음 탐색
- 영상 재생과 단일 HTTP Range 요청
- 표시 영역 기반 썸네일 요청과 최대 4개 동시 생성
- Cloudflare Images로 생성한 정적 WebP 썸네일의 비공개 R2 캐시

## 화면별 지원 범위

데스크톱 UI는 1024×640 이상을 대상으로 합니다. 포인터가 거칠고 화면 너비 또는 높이가 767px 이하인 환경에서는 모바일 UI를 사용합니다.

모바일 파일 시스템은 현재 탐색·보기·다운로드 전용입니다. 다음 작업은 데스크톱에서 수행해야 합니다.

- 업로드
- 이름 변경과 이동
- 휴지통 이동·복원·영구 삭제
- 폴더 생성

폴더와 휴지통은 한 번에 100개 항목을 불러옵니다. 데스크톱의 `Ctrl+A`는 현재까지 불러온 항목만 선택합니다.

여러 파일이나 폴더의 ZIP 다운로드는 File System Access API를 지원하는 최신 데스크톱 Edge·Chrome이 필요합니다. 다운로드가 끝날 때까지 페이지를 열어 두어야 하며 위젯 파일은 ZIP에서 제외됩니다.

현재 지원하지 않는 기능은 문서 미리보기, 파일 내용 편집, 검색, 공유 링크입니다.

## 데이터 저장 방식

| 저장소 | 역할 |
| --- | --- |
| D1 | 폴더 계층, 파일 메타데이터, 위젯 내용·배치, 체크리스트 로그, 모바일 배경화면과 이미지 API 프로필 설정 |
| R2 | 일반 파일 원본과 생성된 썸네일 바이트 |
| 브라우저 `localStorage` | 모바일에서 작성 중인 위젯 초안 하나 |

파일이나 폴더의 이름을 바꾸거나 이동해도 R2 객체 키는 변경하지 않습니다. 위젯 파일은 D1에만 저장되고 일반 파일 바이트만 R2에 저장됩니다. R2의 공개 `r2.dev` 접근은 사용하지 않습니다.

모바일 홈 메뉴의 `배경화면`에서 바탕 화면·내 문서와 하위 폴더의 이미지 파일을 선택할 수 있습니다. 선택한 설정은 D1을 통해 기기 간 공유되며, 이미지 또는 이를 포함한 폴더를 휴지통으로 보내면 기본 Android 배경으로 돌아갑니다.

저장소 상태 위젯은 열 때와 수동 새로 고침 시에만 `GET /api/storage/status`를 호출합니다. R2의 10 GB-month와 D1의 데이터베이스당 500MB 표시는 현재 스냅샷을 비교하는 참고치이며 월 청구량이나 정확한 잔여 무료량을 뜻하지 않습니다.

## 미디어 뷰어 지원 형식

| 종류 | 지원 확장자 | 허용 MIME 타입 |
| --- | --- | --- |
| 이미지 | `.jpg`, `.jpeg`, `.jfif`, `.png`, `.gif`, `.webp`, `.avif`, `.bmp` | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif`, `image/bmp` |
| 영상 | `.mp4`, `.webm`, `.ogg`, `.ogv` | `video/mp4`, `video/webm`, `video/ogg` |

뷰어 지원 여부는 파일명보다 업로드 시 저장된 MIME 타입으로 판단합니다. SVG는 실행 가능한 내용을 포함할 수 있어 인라인으로 표시하지 않습니다. 영상 재생 가능 여부는 브라우저의 컨테이너·코덱 지원 범위에 따라 달라집니다.

JPEG, PNG, GIF, WebP 이미지는 최대 96×96px 정적 WebP 썸네일로 변환합니다. GIF와 애니메이션 WebP는 첫 프레임만 사용합니다. 20MB를 초과한 이미지와 BMP·AVIF는 일반 파일 아이콘으로 표시될 수 있지만 원본 뷰어는 그대로 사용할 수 있습니다.

## 이미지 수신 API 프로필

데스크톱의 시작 메뉴, 내 컴퓨터 또는 빈 바탕 화면 우클릭 메뉴에서 `이미지 API 프로필` 위젯을 열 수 있습니다. 프로필은 D1에 저장되며 Worker를 다시 배포하지 않고 다음 설정을 바꿀 수 있습니다.

- 영문 소문자 slug 기반 프로필 ID와 표시 이름
- 기준 위치: 바탕 화면 또는 내 문서
- 상대 경로와 파일명 템플릿
- JPEG, PNG, GIF, WebP, AVIF, BMP 중 허용할 MIME
- 활성 또는 비활성 상태

프로필 ID는 생성 후 변경할 수 없습니다. 프로필을 삭제해도 기존 파일과 폴더는 유지되며 해당 수신 URL만 `404`로 중단됩니다. 서비스 토큰, Client Secret과 Access audience는 프로필 위젯이나 D1에 저장하지 않습니다.

관리 API는 사용자용 Cloudflare Access 인증을 사용합니다. 쓰기 요청에는 기존 same-origin 검사가 적용됩니다.

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| `GET` | `/api/integrations/image-profiles` | 전체 프로필 조회 |
| `POST` | `/api/integrations/image-profiles` | 프로필 생성 |
| `PUT` | `/api/integrations/image-profiles/:id` | ID를 제외한 전체 설정 교체 |
| `DELETE` | `/api/integrations/image-profiles/:id` | 프로필 삭제 |

`POST` 요청은 다음 형태이며 `PUT`에서는 `id`만 제외합니다.

```json
{
  "id": "camera",
  "displayName": "Camera",
  "rootId": "system-documents-root",
  "pathTemplate": "Camera/{yyyy-MM-dd}",
  "fileNameTemplate": "{HH-mm-ss-SSS}_{uuid}.{ext}",
  "enabled": true,
  "contentTypes": ["image/jpeg", "image/png"]
}
```

경로 템플릿은 `{profileId}`, `{yyyy-MM-dd}`를 지원합니다. 파일명 템플릿은 여기에 `{HH-mm-ss-SSS}`, `{uuid}`, `{ext}`를 추가로 지원하며 `{uuid}`와 `{ext}`가 각각 정확히 한 번 필요합니다. 날짜와 시각은 서버가 이미지를 받은 한국 시각을 사용합니다.

이미지 수신 경로는 `POST /api/integrations/:profileId/images`입니다. 본문에는 multipart나 Base64가 아닌 이미지 원본 한 장을 전송하며, `Content-Type`과 실제 바이트 크기인 `X-File-Size`가 필요합니다. 최대 크기는 100MB이고 성공 응답은 `201 { "file": FilesystemFileEntry }`입니다.

```sh
curl --request POST "https://<computer-room-domain>/api/integrations/<profile-id>/images" \
  --header "CF-Access-Client-Id: <CLIENT_ID>" \
  --header "CF-Access-Client-Secret: <CLIENT_SECRET>" \
  --header "Content-Type: image/png" \
  --header "X-File-Size: <BYTE_LENGTH>" \
  --data-binary "@generated.png"
```

마이그레이션은 기존 호환성을 위해 다음 NovelAI 프로필을 자동 생성합니다.

- URL: `/api/integrations/novelai/images`
- 저장 위치: `바탕 화면/NovelAI/{yyyy-MM-dd}`
- 파일명: `{HH-mm-ss-SSS}_{uuid}.{ext}`
- 허용 MIME: 지원 이미지 6종 전체

### Cloudflare Access 전환 순서

기존 NovelAI 정확 경로 Access 애플리케이션을 운영 중이라면 [Access application path 우선순위](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/) 때문에 다음 순서로 전환합니다.

1. 기존 `NOVELAI_UPLOAD_POLICY_AUD`와 새 `INTEGRATION_UPLOAD_POLICY_AUD`를 함께 허용하는 현재 Worker 코드를 먼저 배포합니다.
2. `/api/integrations/*/images` 경로의 Self-hosted Access 애플리케이션을 만들고 지정 [Access 서비스 토큰](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)만 허용하는 `Service Auth` 정책을 연결합니다.
3. 새 애플리케이션 AUD를 `npx wrangler secret put INTEGRATION_UPLOAD_POLICY_AUD`로 등록한 뒤 Worker를 다시 배포합니다.
4. NovelAI 기존 URL과 새 프로필 URL을 각각 테스트합니다.
5. 정확 경로 애플리케이션을 제거한 뒤 기존 `NOVELAI_UPLOAD_POLICY_AUD`를 정리합니다.

서비스 토큰의 Client ID와 Secret은 저장소나 배포 번들에 넣지 않습니다. 일반 웹 CORS도 허용하지 않습니다.

## 프로젝트 구조

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

클라이언트의 데스크톱·모바일 구현은 `components`와 `styles`에서 분리합니다. API, 상태, 훅, 도메인, 상수와 타입은 기능별 공용 모듈을 우선 사용합니다.

계층은 SOLID 원칙에 따라 분리합니다. 도메인 로직은 React·Cloudflare·D1·R2·HTTP에 의존하지 않고, application 계층은 구체 구현 대신 포트 인터페이스에 의존합니다. D1·R2 세부 구현은 infrastructure 밖으로 노출하지 않습니다.

경로 별칭은 다음과 같습니다.

- `@/*` → `src/*`
- `@client/*` → `src/client/*`
- `@test/*` → `test/*`

barrel `index.ts`는 만들지 않고 소유 모듈을 직접 import합니다. 데스크톱과 모바일 애플리케이션은 서로 다른 CSS·JavaScript 청크로 지연 로딩됩니다.

## 로컬 실행

```sh
npm install
npm run typegen
npm run db:migrate:local
npm run dev
```

필요한 로컬 환경 변수는 [.dev.vars.example](./.dev.vars.example)을 참고하세요. 인증 우회는 로컬 `localhost`에서만 허용됩니다.

주요 Worker 설정:

| 구분 | 이름 |
| --- | --- |
| 환경 변수 | `TEAM_DOMAIN`, `POLICY_AUD`, `OWNER_EMAIL` |
| 비밀 값 | `INTEGRATION_UPLOAD_POLICY_AUD` |
| 전환용 기존 비밀 값 | `NOVELAI_UPLOAD_POLICY_AUD` |
| D1 바인딩 | `DB` |
| R2 바인딩 | `FILES` |
| Images 바인딩 | `IMAGES` |

## 검증

```sh
npm run check
npm test
npm run build
git diff --check
```

- `npm run check`: TypeScript, 마이그레이션 안전성, 디렉터리·파일 구조 검사
- `npm test`: Worker와 React 클라이언트 테스트
- `npm run build`: Worker·클라이언트 프로덕션 빌드와 초기 번들 500KiB 제한 검사

## 배포

1. `wrangler login`으로 Cloudflare 계정에 로그인합니다.
2. `wrangler.jsonc`의 D1·R2·Images 바인딩을 확인합니다.
3. 배포 주소 전체를 Cloudflare Access로 보호하고 본인 계정만 허용합니다.
4. Worker 환경 변수와 비밀 값을 설정합니다.
5. `npm run deploy`를 실행합니다.

`npm run deploy`는 검사·테스트·빌드 후 D1 Time Travel 북마크를 기록하고 원격 마이그레이션과 Worker 배포를 실행합니다. DB 변경이 없는 코드만 다시 배포할 때는 `npm run deploy:worker`를 사용합니다.

원격에 적용된 D1 마이그레이션은 수정하거나 삭제하지 않습니다. 새 마이그레이션은 `npm run db:migration:accept`로 안전성 기준에 등록해야 합니다. 복구가 필요하면 `.wrangler/deploy-bookmarks`에 기록된 북마크와 [D1 Time Travel 문서](https://developers.cloudflare.com/d1/reference/time-travel/)를 확인하세요.

## 라이선스 고지

Windows XP 시각 자산과 외부 라이브러리의 출처·라이선스는 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)에 기록되어 있습니다.
