# 감천 작가 지도

현재 운영 중인 홈페이지의 소스입니다. 별도 시안 프로젝트와 카카오 타일 캡처 도구는 포함하지 않았습니다.

- 홈페이지: `app/home/` (`app/page.tsx`가 불러옴), 신청 폼: `app/apply/`
- 지도: `app/map/` (지도 앱 번들은 art-map 저장소에서 `public/map-app/`으로 내보냄)
- 운영자 화면: `app/admin/`
- 신청·계정·소셜 로그인 API: `app/api/` (소셜 로그인 공통 흐름은 `app/api/auth/social.ts`)
- 공용 헬퍼: `app/lib/` (JSON 파싱, 날짜·상태 라벨, 신청서 상수·입력 정리, 감천 좌표 범위, 응답·쿠키, 브라우저 이미지 축소)
- 이미지와 지도 에셋: `public/`
- DB 스키마: `migrations/*.sql` (Cloudflare D1, `wrangler d1 migrations`로 적용)
- 테스트: `tests/*.test.mts` (`npm test`, Node 내장 테스트 러너)

Node.js 22.13 이상에서 `npm ci` 후 `npm run dev`로 실행합니다. 배포에는 기존 D1·R2 설정과 운영 환경 변수가 필요합니다.

## DB 스키마와 마이그레이션

테이블은 `migrations/0001_init.sql`에 정의되어 있습니다. 예전에는 각 라우트가 요청마다 `CREATE TABLE IF NOT EXISTS`를 실행했는데, 이제는 코드에서 DDL을 실행하지 않습니다.

```powershell
npm run db:migrate:local   # 로컬 개발 DB(.wrangler/state)에 적용. npm run dev 전에 한 번 실행
npm run db:migrate         # 운영 D1에 적용. npm run deploy가 배포 직전에 자동으로 실행
```

스키마를 바꿀 때는 `migrations/0002_*.sql`처럼 새 파일을 추가합니다. 이미 적용된 파일은 수정하지 마세요. 지도 API가 쓰는 `map_places`, `map_alleys`, `map_building_edits`, `gps_trails`는 art-map 저장소가 관리합니다.

한글 경로 폴더에서는 `npm run db:migrate*`도 wrangler가 죽습니다. 그 경우 아래 배포 스크립트처럼 드라이브를 매핑한 뒤 실행하거나, 배포 스크립트에 맡기세요.

## 계정·세션 규칙

- **비밀번호**: 사용자별 솔트 PBKDF2-SHA256(100,000회)으로 저장(`app/admin/password-hash.ts`). 8자 이상 200자 이하, 앞뒤 공백 불가(`app/lib/account-rules.ts`). 옛 SHA-256 해시 계정은 로그인 성공 시 자동으로 새 형식으로 바뀝니다.
- **세션 무효화**: `accounts.session_version`을 세션 토큰에 넣고 요청마다 DB 값과 비교합니다. 계정 정지·삭제, 비밀번호 변경·초기화, 관리자 승격 때 버전이 올라가 그 계정의 기존 세션이 모두 끊깁니다. 비밀번호를 바꾼 기기에는 새 세션이 바로 다시 발급됩니다.
- **소셜 아이디 보호**: `google_`, `kakao_`, `naver_`로 시작하는 아이디는 일반 가입에서 막습니다(소셜 계정의 login_id 형식).
- **환경변수 관리자**: `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH`로 로그인하는 초기 관리자는 DB에 활성 관리자 계정이 하나도 없을 때만 동작합니다. 관리자 화면에서 작가 계정을 관리자로 승격한 뒤에는 이 비밀값을 지워도 됩니다.
- **신청서 이미지**: 초안 하나당 R2 객체 30개까지 올릴 수 있고, 제출 시 신청서에 기록되지 않은 객체는 지워집니다. 관리자가 신청서를 삭제하면 접두어 아래 객체를 모두 지웁니다.
- **속도 제한**: 코드에는 없습니다. Cloudflare 대시보드의 WAF → Rate limiting rules에서 `/api/auth/login`, `/api/auth/signup`에 분당 요청 제한을 걸어 두세요.

## 빌드·배포 (Windows)

```powershell
npm run deploy                 # 설치(lockfile이 바뀐 경우만) → 빌드 → Cloudflare 배포
npm run deploy -- -BuildOnly   # 빌드까지만 (dist/ 확인용)
npm run deploy -- -SkipInstall # npm ci 건너뛰기
```

`scripts/deploy.ps1`이 하는 일:

- **한글 경로 우회**: 프로젝트 폴더 경로에 한글이 있으면(예: `Desktop\이거`) wrangler와 vinext가 Node 접근 위반(0xC0000005)으로 바로 종료됩니다. 스크립트가 폴더를 빈 드라이브 문자(`G:` 등)에 `subst`로 매핑해 ASCII 경로에서 실행하고, 끝나면 매핑을 해제합니다. 폴더 이름을 영문으로 바꾸면 이 우회는 필요 없습니다.
- **설치 생략**: `package-lock.json` 해시를 `node_modules/.deploy-lockfile-sha256`에 기록해 두고, 바뀌지 않았으면 `npm ci`(약 100초)를 건너뜁니다.
- **배포 전 계정 확인과 마이그레이션**: `wrangler whoami` → `wrangler d1 migrations apply --remote` → `wrangler deploy` 순서로 실행합니다.

PowerShell 실행 정책이 기본값(Restricted)이라 스크립트가 막히면 한 번만 다음을 실행하세요.

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

수동으로 할 때는 `npx vinext build` 뒤 `npx wrangler deploy`입니다(한글 경로에서는 위와 같이 드라이브 매핑이 필요합니다).

## 운영 환경

### 백업

```powershell
npm run backup            # D1 전체 → backups/d1-<날짜>.sql, rclone이 있으면 R2 → backups/r2-<날짜>/
npm run backup -- -SkipR2 # D1만
```

- D1에는 신청서·계정·작품 해설이, R2에는 작품 이미지가 있습니다. D1만 받으면 이미지가 빠집니다.
- R2는 rclone으로 받습니다. Cloudflare 대시보드 → R2 → Manage R2 API Tokens에서 읽기 전용 토큰을 만들고, `rclone config`로 S3 호환 remote를 `gamcheon-r2` 이름으로 추가하세요(provider Cloudflare, endpoint `https://<계정 ID>.r2.cloudflarestorage.com`).
- 복원: `wrangler d1 execute gamcheon-artist-map-apply-db --remote --file backups/d1-<날짜>.sql`. 운영 DB에 바로 넣기 전에 로컬(`--local`)에서 먼저 확인하세요.
- `backups/`는 Git에 올라가지 않습니다. 개인정보가 들어 있으니 안전한 저장소로 옮기고 복사본은 지우세요. 주 1회 정도 받아 두길 권합니다.

### 로그인 속도 제한 (Cloudflare 대시보드)

코드에는 속도 제한이 없습니다. Cloudflare 대시보드 → artist-map.com → Security → WAF → Rate limiting rules에서 다음 규칙을 추가하세요.

| 규칙 | 조건 | 제한 |
| --- | --- | --- |
| 로그인 | URI Path equals `/api/auth/login`, Method POST | 같은 IP 10회 / 1분 → Block 10분 |
| 가입 | URI Path equals `/api/auth/signup`, Method POST | 같은 IP 5회 / 10분 → Block 1시간 |
| 소셜 로그인 시작 | URI Path starts with `/api/auth/` and ends with `/start` | 같은 IP 20회 / 1분 → Block 10분 |

### 폴더 이름

프로젝트 폴더 경로에 한글이 들어가면 wrangler·vinext·tsc가 Node 접근 위반으로 종료됩니다(이 PC의 Node 22.13 기준). 폴더 이름은 영문으로 두세요. 배포·백업 스크립트는 한글 경로를 만나면 드라이브 문자에 매핑해 우회하지만, `npx wrangler ...`를 직접 치는 경우는 우회되지 않습니다.

### 걸리는 시간 기준 (이 PC, 2026-10-27 측정)

| 단계 | 시간 |
| --- | --- |
| `npm ci` | 약 100초 |
| `vinext build` | 약 8초 (수정 전 약 5분) |
| `wrangler deploy` | 약 10초 |

빌드가 5분 걸리던 원인은 Tailwind 4의 자동 소스 탐지였습니다. 프로젝트 전체를 스캔하면서 `public/map-app/assets/`의 4MB짜리 압축 JS까지 읽어 클래스 후보를 뽑느라 CSS를 처리하는 빌드 단계(1/5, 3/5)마다 2분 30초씩 멈췄습니다. `app/globals.css`에서 자동 탐지를 끄고 `@source "../app"`만 스캔하도록 바꿔 해결했습니다. 새 컴포넌트 폴더를 `app/` 바깥에 만들면 거기도 `@source`로 추가해야 Tailwind 클래스가 생성됩니다.

클라우드(Sites) 빌드 스크립트 `scripts/build-verified.sh`의 빌드 제한시간은 12분, `scripts/install-ci.sh`의 npm 동시 연결 수는 8입니다. 예전 값(3분, 연결 1개)은 설치가 매우 느리고 빌드가 시간 초과로 끊길 수 있었습니다.
