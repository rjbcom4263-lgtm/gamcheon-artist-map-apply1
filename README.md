# 감천 작가 지도

현재 운영 중인 홈페이지의 소스입니다. 별도 시안 프로젝트와 카카오 타일 캡처 도구는 포함하지 않았습니다.

- 홈페이지: `app/landing-sample/`, `app/page.tsx`
- 지도: `app/map/`, `public/map-data/`
- 운영자 화면: `app/admin/`
- 신청·계정 API: `app/api/`
- 이미지와 지도 에셋: `public/`

Node.js 22.13 이상에서 `npm ci` 후 `npm run dev`로 실행합니다. Windows에서 빌드는 `npx vinext build`, Cloudflare Worker 배포는 빌드 후 `npx wrangler deploy`를 사용합니다. 배포에는 기존 D1·R2 설정과 운영 환경 변수가 필요합니다.
