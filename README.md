# computer-room

소유자 공간은 Cloudflare Access로 보호하고, 선택한 항목만 게스트에게
공개할 수 있는 개인용 가상 컴퓨터 홈입니다.

- 데스크톱은 Windows XP Luna 스타일입니다.
- 모바일은 초기 Android 스타일입니다.

## 주요 기능

### 데스크톱

- 자유롭게 이동하고 크기를 조절할 수 있는 XP 스타일 프로그램 창
- 시작 메뉴, 작업 표시줄, 바탕 화면, 내 문서, 내 컴퓨터와 휴지통
- 다중 선택, 드래그 앤 드롭과 XP형 메뉴를 지원하는 파일 탐색기
- 게스트에게 공개할 파일·폴더·프로그램 문서를 선택하는 관리자

### 모바일

- 초기 Android 스타일 홈 화면과 뒤로·홈·메뉴 탐색
- 폴더 탐색, 미디어 보기, 파일 다운로드와 저장소 상태 확인
- 이미지 좌우 스와이프와 계정 공용 홈 배경화면
- 로컬 메모·체크리스트 초안 작성과 프로그램 문서 저장

### 프로그램과 파일

- 마크다운 메모와 한국 날짜 기준 일일 체크리스트
- R2·D1 사용량을 보여주는 저장소 상태
- 이미지 수신 경로와 기록을 관리하는 이미지 API 프로필
- 폴더별 정렬, 파일 업로드·다운로드·이동과 휴지통 복원
- 이미지·영상 뷰어와 비공개 썸네일
- txt·json·md 등을 원문으로 여는 읽기 전용 메모장

파일로 저장하지 않는 내장 프로그램은 다음 접속 때 자동으로 열리지 않습니다.
저장된 프로그램 문서와 일반 파일은 바탕 화면·내 문서 계층에서 함께 관리합니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 언어 | TypeScript |
| UI | React, React Markdown |
| 스타일 | CSS, XP.css, react-rnd |
| 빌드·테스트 | Vite, Vitest, Testing Library |
| 런타임·배포 | Cloudflare Workers, Wrangler |
| 인증 | Cloudflare Access, Access Service Token |
| 데이터 | Cloudflare D1, Drizzle ORM |
| 파일·이미지 | Cloudflare R2, Cloudflare Images |

정확한 라이브러리 버전은 [package.json](./package.json)을 기준으로 합니다.

## 지원 범위

데스크톱 UI는 1024×640 이상을 대상으로 하며, 작은 터치 화면에는 모바일
UI를 제공합니다.

모바일 파일 시스템은 탐색·보기·다운로드 중심이며, 업로드·이름 변경·이동과
휴지통 관리는 데스크톱에서 수행합니다. 여러 파일이나 폴더의 ZIP 다운로드는
File System Access API를 지원하는 최신 데스크톱 Edge·Chrome이 필요합니다.

게스트는 소유자가 공개한 항목만 읽을 수 있습니다. 자세한 화면별 기능, 게스트
정책과 미디어 지원 형식은 [상세 문서](./documents/INDEX.md)를 참고하세요.

## 로컬 실행

```sh
npm install
npm run typegen
npm run db:migrate:local
npm run dev
```

필요한 로컬 환경 변수는 [.dev.vars.example](./.dev.vars.example)을 참고하세요.
인증 우회는 로컬 `localhost`에서만 허용됩니다.

## 검증과 배포

```sh
npm run check
npm test
npm run build
git diff --check
```

전체 검증, 원격 D1 마이그레이션과 Worker 배포는 다음 명령으로 실행합니다.

```sh
npm run deploy
```

DB 변경이 없는 Worker만 다시 배포할 때는 `npm run deploy:worker`를 사용합니다.
환경 설정과 복구 절차는 [배포 문서](./documents/DEPLOYMENT.md)를 참고하세요.

## 문서

전체 문서 목록과 각 문서의 용도는
[documents/INDEX.md](./documents/INDEX.md)에 정리되어 있습니다.

- [기능 안내](./documents/FEATURES.md)
- [게스트 공개와 Access 설정](./documents/GUEST_ACCESS.md)
- [이미지 수신 API](./documents/IMAGE_UPLOAD_API.md)
- [D1 데이터베이스 명세](./documents/DATABASE_SCHEMA.md)
- [개발 안내](./documents/DEVELOPMENT.md)

## 라이선스 고지

Windows XP 시각 자산과 외부 라이브러리의 출처·라이선스는
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)에 기록되어 있습니다.
