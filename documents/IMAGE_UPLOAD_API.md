# 이미지 수신 API

[문서 목차로 돌아가기](./INDEX.md)

## 이미지 API 프로필

데스크톱 시작 메뉴, 내 컴퓨터 또는 바탕 화면 메뉴에서 `이미지 API 프로필`
프로그램을 실행합니다. 프로필은 D1에 저장되므로 Worker를 재배포하지 않고
다음 설정을 바꿀 수 있습니다.

- 영문 소문자 slug 기반 ID와 표시 이름
- 기준 위치: 바탕 화면 또는 내 문서
- 상대 경로와 파일명 템플릿
- [지원 이미지 MIME](./MEDIA_SUPPORT.md) 중 허용할 형식
- 활성 또는 비활성 상태

ID는 생성 후 변경할 수 없습니다. 프로필을 삭제해도 기존 파일·폴더는
유지되며 해당 수신 URL만 `404`로 중단됩니다. 비활성·미등록 프로필도 수신
요청에 `404`를 반환합니다.

서비스 토큰, Client Secret과 Access audience는 프로필이나 D1에 저장하지
않습니다.

## 프로필 관리 API

소유자 Cloudflare Access 인증을 사용합니다. 쓰기 요청에는 same-origin
검사를 적용하고 응답은 `private, no-store`로 반환합니다.

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| `GET` | `/api/integrations/image-profiles` | 전체 프로필 조회 |
| `POST` | `/api/integrations/image-profiles` | 프로필 생성 |
| `PUT` | `/api/integrations/image-profiles/:id` | ID를 제외한 전체 설정 교체 |
| `DELETE` | `/api/integrations/image-profiles/:id` | 프로필 삭제 |

목록 응답은 `{ items }`, 생성·수정 응답은 `{ profile }`입니다. 생성은
`201`, 수정은 `200`, 삭제는 본문 없는 `204`를 반환합니다.

`POST` 요청 예시는 다음과 같으며 `PUT`에서는 `id`만 제외합니다.

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

경로 템플릿은 `{profileId}`, `{yyyy-MM-dd}`를 지원합니다. 파일명 템플릿은
여기에 `{HH-mm-ss-SSS}`, `{uuid}`, `{ext}`를 추가로 지원하며 `{uuid}`와
`{ext}`가 각각 정확히 한 번 필요합니다. 날짜와 시각은 이미지 생성 시각이
아닌 서버가 이미지를 받은 한국 시각입니다.

## 이미지 전송

수신 경로는 `POST /api/integrations/:profileId/images`입니다. multipart나
Base64 JSON 대신 이미지 원본 한 장을 바이너리 본문으로 보냅니다.

| 헤더 | 값 |
| --- | --- |
| `CF-Access-Client-Id` | 발급받은 서비스 토큰의 Client ID |
| `CF-Access-Client-Secret` | 발급받은 서비스 토큰의 Client Secret |
| `Content-Type` | 프로필에서 허용한 이미지 MIME |
| `X-File-Size` | 본문의 실제 바이트 크기 |

서비스 토큰명이나 토큰 리소스 ID가 아니라 발급 시 제공되는 Client ID와
Secret을 사용합니다.
[Access 서비스 토큰](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)

최대 크기는 100MB이며 성공 응답은 `201 { "file": FilesystemFileEntry }`입니다.
호출자는 파일명이나 저장 위치를 지정하지 않고, 프로필의 템플릿을 사용합니다.

```sh
curl --request POST "https://<computer-room-domain>/api/integrations/<profile-id>/images" \
  --header "CF-Access-Client-Id: <CLIENT_ID>" \
  --header "CF-Access-Client-Secret: <CLIENT_SECRET>" \
  --header "Content-Type: image/png" \
  --header "X-File-Size: <BYTE_LENGTH>" \
  --data-binary "@generated.png"
```

## 수신 기록과 보관 기간

`수신 기록` 탭에서 인증을 통과해 수신 핸들러에 도달한 POST 요청의 성공·실패,
수신 시각, 송신 IP, MIME, 선언 크기와 처리 시간을 확인합니다. 성공 파일이
활성 바탕 화면·내 문서 계층에 남아 있으면 기록에서 바로 열 수 있습니다.

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| `GET` | `/api/integrations/image-upload-logs` | `profileId`, `outcome`, `cursor`로 기록 조회 |
| `GET` | `/api/integrations/image-upload-logs/settings` | 공통 보관 기간 조회 |
| `PATCH` | `/api/integrations/image-upload-logs/settings` | 공통 보관 기간 변경 |

모두 소유자 전용이며 설정 변경에는 same-origin 검사를 적용합니다. 설정
요청은 `{ "retentionDays": 30 }`, 응답은
`{ "settings": { "retentionDays": 30 } }` 형식입니다.

보관 기간은 전체 프로필 공통 1~365일이며 기본값은 30일입니다. 기간 변경은
조회에 즉시 반영되고 실제 만료 행 삭제는 다음 00:00 KST 정기 작업에서
수행합니다. 삭제 전에 기간을 다시 늘리면 아직 남아 있는 기록이 다시
보일 수 있습니다.

송신 IP는 Cloudflare의
[`CF-Connecting-IP`](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip)에서
읽습니다. 유효한 IPv4·IPv6를 마스킹 없이 로그와 함께 보관하며, 누락되거나
비정상인 값과 기존 기록은 `NULL`로 저장하고 화면에 `-`로 표시합니다.
프록시·VPN을 거치면 해당 외부 IP가 기록될 수 있습니다.

Cloudflare Access에서 먼저 거부된 요청과 Worker에 도달하지 못한 네트워크
오류는 D1 수신 기록에 남지 않습니다. 서비스 토큰, 인증 헤더, 이미지 본문과
R2 객체 키는 기록하지 않으며 송신 IP도 콘솔 운영 로그에 출력하지 않습니다.

Cron과 복구 정책은 [배포 문서](./DEPLOYMENT.md)를 참고하세요.

## 기본 NovelAI 프로필

마이그레이션은 기존 호환성을 위해 다음 프로필을 생성합니다.

| 항목 | 값 |
| --- | --- |
| ID | `novelai` |
| URL | `/api/integrations/novelai/images` |
| 저장 위치 | `바탕 화면/NovelAI/{yyyy-MM-dd}` |
| 파일명 | `{HH-mm-ss-SSS}_{uuid}.{ext}` |
| 허용 MIME | 지원 이미지 6종 전체 |

다른 프로필과 동일하게 수정하거나 삭제할 수 있습니다.

## Cloudflare Access 설정과 전환

새 환경에서는 `/api/integrations/*/images` 경로의 Self-hosted Access
애플리케이션을 만들고 지정 서비스 토큰만 허용하는 `Service Auth` 정책을
연결합니다. 애플리케이션 AUD는 Worker의 `INTEGRATION_UPLOAD_POLICY_AUD`로
등록합니다.

```sh
npx wrangler secret put INTEGRATION_UPLOAD_POLICY_AUD
```

기존 NovelAI 정확 경로 애플리케이션을 운영 중이라면 더 구체적인 경로가
우선하므로 다음 순서로 전환합니다.
[Access 경로 우선순위](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)

1. 기존 `NOVELAI_UPLOAD_POLICY_AUD`와 새 audience를 모두 허용하는 현재
   Worker 코드를 먼저 배포합니다.
2. wildcard 경로 애플리케이션과 Service Auth 정책을 생성합니다.
3. 새 AUD를 등록하고 Worker를 다시 배포합니다.
4. NovelAI 기존 URL과 새 프로필 URL을 각각 테스트합니다.
5. 기존 정확 경로 애플리케이션을 제거한 뒤 `NOVELAI_UPLOAD_POLICY_AUD`를
   정리합니다.

Client ID·Secret은 저장소나 배포 번들에 넣지 않습니다. 일반 웹페이지용
CORS는 허용하지 않습니다.
