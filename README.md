# 감천 작가 지도

현재 운영 중인 홈페이지의 소스입니다. 별도 시안 프로젝트와 카카오 타일 캡처 도구는 포함하지 않았습니다.

- 홈페이지: `app/landing-sample/`, `app/page.tsx`
- 지도: `app/map/`, `public/map-data/`
- 운영자 화면: `app/admin/`
- 신청·계정 API: `app/api/`
- 이미지와 지도 에셋: `public/`

Node.js 22.13 이상에서 `npm ci` 후 `npm run dev`로 실행합니다. 배포에는 기존 D1·R2 설정과 운영 환경 변수가 필요합니다.

## 빌드·배포 (Windows)

```powershell
npm run deploy                 # 설치(lockfile이 바뀐 경우만) → 빌드 → Cloudflare 배포
npm run deploy -- -BuildOnly   # 빌드까지만 (dist/ 확인용)
npm run deploy -- -SkipInstall # npm ci 건너뛰기
```

`scripts/deploy.ps1`이 하는 일:

- **한글 경로 우회**: 프로젝트 폴더 경로에 한글이 있으면(예: `Desktop\이거`) wrangler와 vinext가 Node 접근 위반(0xC0000005)으로 바로 종료됩니다. 스크립트가 폴더를 빈 드라이브 문자(`G:` 등)에 `subst`로 매핑해 ASCII 경로에서 실행하고, 끝나면 매핑을 해제합니다. 폴더 이름을 영문으로 바꾸면 이 우회는 필요 없습니다.
- **설치 생략**: `package-lock.json` 해시를 `node_modules/.deploy-lockfile-sha256`에 기록해 두고, 바뀌지 않았으면 `npm ci`(약 100초)를 건너뜁니다.
- **배포 전 계정 확인**: `wrangler whoami` 뒤 `wrangler deploy`를 실행합니다.

PowerShell 실행 정책이 기본값(Restricted)이라 스크립트가 막히면 한 번만 다음을 실행하세요.

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

수동으로 할 때는 `npx vinext build` 뒤 `npx wrangler deploy`입니다(한글 경로에서는 위와 같이 드라이브 매핑이 필요합니다).

### 걸리는 시간 기준 (이 PC, 2026-10-27 측정)

| 단계 | 시간 |
| --- | --- |
| `npm ci` | 약 100초 |
| `vinext build` | 약 8초 (수정 전 약 5분) |
| `wrangler deploy` | 약 10초 |

빌드가 5분 걸리던 원인은 Tailwind 4의 자동 소스 탐지였습니다. 프로젝트 전체를 스캔하면서 `public/map-app/assets/`의 4MB짜리 압축 JS까지 읽어 클래스 후보를 뽑느라 CSS를 처리하는 빌드 단계(1/5, 3/5)마다 2분 30초씩 멈췄습니다. `app/globals.css`에서 자동 탐지를 끄고 `@source "../app"`만 스캔하도록 바꿔 해결했습니다. 새 컴포넌트 폴더를 `app/` 바깥에 만들면 거기도 `@source`로 추가해야 Tailwind 클래스가 생성됩니다.

클라우드(Sites) 빌드 스크립트 `scripts/build-verified.sh`의 빌드 제한시간은 12분, `scripts/install-ci.sh`의 npm 동시 연결 수는 8입니다. 예전 값(3분, 연결 1개)은 설치가 매우 느리고 빌드가 시간 초과로 끊길 수 있었습니다.
