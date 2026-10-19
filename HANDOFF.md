# 감천 작가 지도 홈페이지 인수인계

## 인계 대상

이 저장소가 홈페이지 소스 기준본입니다. 홈페이지 코드를 복사한 뒤 `gamcheon-artist-apply-package-v1/site`나 실험 폴더를 운영본으로 사용하지 마세요. 현재 운영 Worker는 `gamcheon-artist-map-apply`이며, Cloudflare D1과 R2가 홈페이지 데이터와 작품 이미지를 보관합니다.

## 로컬 실행과 배포

Node.js 22.13 이상과 이 저장소 전체가 필요합니다. Windows PowerShell에서:

```powershell
npm ci
npm run dev
```

배포는 Cloudflare 계정과 권한을 넘겨받고, 먼저 로컬 빌드가 완료된 다음 진행합니다.

```powershell
npx vinext build
npx wrangler whoami
npx wrangler deploy
```

배포 전에 `wrangler whoami`가 인수받은 운영 계정을 가리키는지 확인하세요. `wrangler.jsonc`의 Worker 이름, D1/R2 바인딩과 ID는 현재 운영 리소스에 연결되어 있으므로 새 리소스 ID로 바꾸지 마세요. Cloudflare 대시보드에서 기존 Worker의 도메인, Routes, Variables/Secrets가 유지되는지도 확인하세요.

## 꼭 함께 인계할 계정과 설정

파일만으로 운영을 이어갈 수 없습니다. 비밀번호를 주고받지 말고 수신자를 각 서비스에 초대한 뒤, 인수자가 로그인과 권한을 확인하세요.

- Cloudflare: 기존 계정 또는 도메인 계정 초대, Workers 배포 권한, D1 `gamcheon-artist-map-apply-db`, R2 `gamcheon-artist-map-apply-images` 접근
- DNS/도메인: 운영 주소가 별도 도메인을 사용한다면 등록기관과 DNS 관리 계정 또는 위임 권한
- 관리자 비밀값: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`
- 소셜 로그인: 사용하는 제공자에 한해 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 및 OAuth 콘솔의 callback URL 관리 권한
- 카카오 주소 검색: `KAKAO_REST_API_KEY`와 허용 도메인 설정 권한
- AI 지도 타일 변환: 사용 중일 때 `MUAPI_API_KEY`

어떤 통합이 현재 실제로 활성화되어 있는지는 Cloudflare Worker의 Secrets/Variables와 각 제공자 콘솔에서 인수자가 확인해야 합니다. 비밀값을 이 저장소, ZIP, 이메일에 넣지 마세요. 필요하면 계정 이전 후 새 비밀값으로 교체하세요.

## 데이터도 별도로 인계

코드 저장소에는 운영 데이터가 없습니다. 인수 당일에 인계자와 인수자가 함께 최신 백업을 만들고, 안전한 저장소로 전달한 뒤 복원 가능 여부와 샘플 데이터를 확인하세요.

- D1 전체 데이터베이스: 작가 신청서, 계정·소셜 로그인 연결, 지도 타일·경계 등
- R2 전체 객체: 신청서 작품 이미지와 지도 타일 등. D1만 전달하면 이미지가 빠질 수 있습니다.
- Cloudflare 설정: Worker 도메인/라우트, Secrets/Variables, D1·R2 연결 정보

백업에는 개인정보가 포함될 수 있으므로 접근을 제한하고, 수신 확인 후 임시 복사본을 정리하세요. DB 스키마는 `app/applications-db.ts`, `app/admin/admin-auth.ts`, 지도 API에서 관리하며 `database/schema.sql`은 상위 패키지 자료입니다. 이 프로젝트만 전달할 때 그 상위 폴더를 운영 코드로 착각하지 마세요.

## 인수 확인 순서

1. 인수자가 저장소 전체를 받아 `npm ci`와 `npm run dev`를 실행합니다.
2. 인수받은 계정으로 Cloudflare에 로그인해 Worker, D1, R2 접근 권한을 확인합니다.
3. 백업을 별도로 받아 크기와 파일 목록, D1 테이블·R2 객체가 있는지 함께 확인합니다. 운영 데이터에 쓰기 전 복구 위치를 합의하세요.
4. 변경 없이 빌드하고, 공개 홈페이지·`/map`·로그인·신청·관리자 페이지·작품 이미지 조회를 확인합니다.
5. 인수자가 배포 책임을 맡기로 합의하기 전에는 계정 소유자나 비밀값을 회수하지 않습니다.

## 파일에서 제외할 것

일반 소스 전달 묶음에서 `.git/`, `node_modules/`, `.wrangler/`, `dist/`, `.next/`, `.sites-runtime/`, `.env*`, 로컬 로그와 캐시는 제외합니다. 의존성은 `package-lock.json`으로 다시 설치하고 배포 산출물은 `npx vinext build`로 만듭니다. `build/`는 배포 도구의 소스 코드라 제외하지 마세요.

## 저장소 안내

- GitHub: `https://github.com/rjbcom4263-lgtm/gamcheon-artist-map-apply1`
- 서비스 주소: 저장소 README 및 Cloudflare Worker의 현재 도메인 설정을 기준으로 인수자가 확인
- Cloudflare 최신 배포 절차: [Wrangler 배포 문서](https://developers.cloudflare.com/workers/wrangler/commands/#deploy)
- D1 데이터 백업/복원: [Cloudflare D1 가져오기·내보내기 문서](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- R2 객체 백업/복원: [Cloudflare R2 객체 다운로드 문서](https://developers.cloudflare.com/r2/objects/download-objects/)
