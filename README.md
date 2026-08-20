# computer-room

Cloudflare Access로 보호되는 1인용 위젯 홈페이지입니다. React 화면과 API는 Cloudflare Workers에서 실행되며, 위젯 배치는 D1에 저장됩니다. R2와 기존 파일 API는 이후 파일 관련 위젯에서 사용할 수 있도록 독립된 기능으로 유지합니다.

## 현재 구현 범위

- Cloudflare Access 인증 정보를 표시하는 개인 홈 화면
- 마크다운 작성·미리보기·저장을 지원하는 메모 위젯
- 한국 날짜 기준으로 매일 체크 상태가 초기화되는 일일 체크리스트 위젯
- 체크 항목 추가·수정·삭제와 체크/체크 취소 로그 상세보기
- 1024px 이상 화면의 12열 격자 편집
- 위젯 드래그, 크기 변경, 저장, 취소
- 1024px 미만 화면의 1열 목록과 위젯 콘텐츠 편집
- D1 기반 위젯 배치, 메모, 체크 상태와 이벤트 로그 저장
- 비공개 R2 파일 업로드·목록·다운로드·삭제 API

초기 화면은 기능 검증에 필요한 최소한의 스타일만 적용했습니다. 2000~2010년대 홈페이지 콘셉트는 위젯 동작과 반응형 정책이 안정된 뒤 별도 표현 계층에서 확장합니다.

## 구조

- `src/client`: React 화면, UI 상태, 브라우저 API 어댑터
- `src/domain`: 위젯 배치와 파일 규칙처럼 플랫폼에 의존하지 않는 핵심 로직
- `src/application`: 위젯 배치와 파일 관리 유스케이스
- `src/constants`: 조정 가능한 정책값과 API·인증·HTTP 계약, 책임별 오류 카탈로그
- `src/types`: 도메인 모델과 포트 인터페이스
- `src/infrastructure`: D1, R2, Cloudflare Access 구현체
- `src/http`: 요청 검증, 라우팅, 응답 직렬화
- `src/index.ts`: 구체 구현을 조립하는 composition root

페이지 크기, 격자 크기, 파일 제한처럼 운영 중 조정할 수 있는 값은 사용처 수와 관계없이 `constants`에 둡니다. 변경 가능성이 없고 한 모듈에만 속하는 정규식·DOM 선택자 같은 구현 상수는 사용 위치 가까이에 둡니다.

오류 코드는 `constants/errors`에서 책임별로 코드·메시지·HTTP 상태를 함께 관리합니다. 서비스와 HTTP 계층은 구체 저장소 대신 역할별 인터페이스에 의존하므로 D1·R2 구현이나 UI 라이브러리를 다른 구현으로 교체할 수 있습니다. React Grid Layout 의존성은 데스크톱 격자 어댑터 한 곳에만 격리했습니다. 메모 마크다운은 raw HTML을 실행하지 않으며, 체크리스트의 날짜와 다음 초기화 시각은 서버가 한국 시간을 기준으로 결정합니다.

## 로컬 실행

```sh
npm install
npm run typegen
npm run db:migrate:local
npm run dev
```

로컬에서만 `.dev.vars`의 인증 우회를 사용합니다. 필요한 키는 [.dev.vars.example](./.dev.vars.example)을 참고하세요. 배포 환경에서는 Cloudflare Access JWT와 소유자 이메일을 모두 검증합니다.

## 배포

1. `wrangler login`으로 사용할 Cloudflare 계정에 로그인합니다.
2. `wrangler.jsonc`의 D1과 R2 바인딩이 생성한 저장소를 가리키는지 확인합니다.
3. `npm run db:migrate:remote`로 D1 마이그레이션을 적용합니다. 기존 빈 위젯은 같은 위치와 크기의 메모 위젯으로 변환됩니다.
4. `npm run deploy`로 Worker와 React 정적 자산을 배포합니다.
5. 배포 주소 전체를 Cloudflare Access로 보호하고 본인 계정만 허용합니다.
6. Worker 환경 변수 `TEAM_DOMAIN`, `POLICY_AUD`, `OWNER_EMAIL`을 설정합니다.
7. R2의 `r2.dev` 공개 접근은 활성화하지 않습니다.

## 검증

```sh
npm run check
npm test
npm run build
```
