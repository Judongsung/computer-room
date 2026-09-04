# 배포 안내

[문서 목차로 돌아가기](./INDEX.md)

## 사전 설정

1. `npx wrangler login`으로 배포할 Cloudflare 계정에 로그인합니다.
2. [wrangler.jsonc](../wrangler.jsonc)의 D1·R2·Images와 Rate Limiting 바인딩을
   확인합니다.
3. [게스트 공개 문서](./GUEST_ACCESS.md)에 따라 정적 셸·게스트 API·소유자 API의
   Access 정책을 구분합니다.
4. 이미지 수신을 사용하면 [이미지 수신 API 문서](./IMAGE_UPLOAD_API.md)의
   Service Auth 애플리케이션과 서비스 토큰을 준비합니다.
5. Worker 환경 변수와 secret을 설정합니다.

| 구분 | 이름 |
| --- | --- |
| 환경 변수 | `TEAM_DOMAIN`, `POLICY_AUD`, `OWNER_EMAIL` |
| 이미지 수신 Access audience | `INTEGRATION_UPLOAD_POLICY_AUD` |
| 전환용 기존 audience | `NOVELAI_UPLOAD_POLICY_AUD` |
| D1 바인딩 | `DB` |
| R2 바인딩 | `FILES` |
| Images 바인딩 | `IMAGES` |

운영 환경은 `ENVIRONMENT=production`을 유지하고 개발용 인증 우회를
활성화하지 않습니다. audience는 애플리케이션 식별자이며 서비스 토큰의
Client ID·Secret과 다릅니다. 서비스 토큰 비밀값은 호출자가 보관하고 Worker
소스나 배포 번들에 넣지 않습니다.

## 배포 명령

기본 배포는 보호 절차가 포함된 다음 명령을 사용합니다.

```sh
npm run deploy
```

이 명령은 검사·전체 테스트·빌드 후 D1 Time Travel 북마크를 기록하고, 원격
마이그레이션과 Worker 배포를 순서대로 실행합니다. 앞 단계가 실패하면
다음 단계로 진행하지 않습니다.

DB 변경 없이 Worker만 다시 배포할 때는 다음 명령을 사용할 수 있습니다.

```sh
npm run deploy:worker
```

`deploy:worker`는 빌드와 Worker 배포만 수행합니다. 전체 검사·테스트,
복구 북마크 기록과 마이그레이션을 생략하므로 별도로 검증했고 원격 DB가
요구 스키마를 갖춘 경우에만 사용합니다.

## D1 마이그레이션과 복구

원격에 적용된 마이그레이션 파일은 수정하거나 삭제하지 않습니다. 새
마이그레이션은 데이터 보존과 회귀 테스트를 검토한 후
`npm run db:migration:accept`로 안전성 기준에 등록합니다.

배포 전 기록한 북마크는 로컬 `.wrangler/deploy-bookmarks`에 남습니다.
복구가 필요하면 해당 북마크와
[D1 Time Travel 문서](https://developers.cloudflare.com/d1/reference/time-travel/)를
확인합니다. DB 복구는 해당 시점 이후 데이터를 되돌리는 작업이므로 대상과
시점을 확인한 후 별도로 수행해야 합니다.

현재 애플리케이션 스키마는 [데이터베이스 명세](./DATABASE_SCHEMA.md)에 있습니다.

## Cron 운영

[Wrangler 설정](../wrangler.jsonc)의 `0 15 * * *`는 매일 15:00 UTC,
즉 다음 한국 날짜의 00:00 KST에 실행됩니다. Cloudflare Cron은 UTC 기준이며
설정 변경은 전역 반영까지 시간이 걸릴 수 있습니다.
[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

현재 작업은 이미지 수신 로그의 보관 기간을 읽어 만료 행과 송신 IP를
삭제합니다. 정리가 실패하면 다음 실행에서 다시 대상이 되며, 조회 API는
보관 기준을 넘은 행을 표시하지 않습니다. 원본 파일·썸네일과 파일 시스템
데이터는 정리 대상이 아닙니다.

새 작업의 등록과 독립 실행 규칙은 [개발 안내](./DEVELOPMENT.md)를 참고하세요.
