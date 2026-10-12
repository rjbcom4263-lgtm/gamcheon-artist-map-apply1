import { env } from "cloudflare:workers";
import { requireAdmin } from "../admin/admin-auth";
import { handleApi } from "./generated/map-api";

// 감천 골목지도 API입니다. 검사·저장 규칙은 art-map 저장소의 server/에 있고, npm run export:site가
// generated/map-api.js로 묶어 넣습니다. 이 사이트는 데이터베이스(DB)·파일 저장소(BUCKET)와 운영자 확인만 넘겨줍니다.
// 주소: /api/map-alleys, /api/map-buildings, /api/map-models/<번호>(공개), /api/admin/map-*, /api/admin/gps-trails(운영자)
export function mapApi(request: Request) {
  return handleApi(request, { DB: env.DB, MODELS: env.BUCKET, isAdmin: async () => Boolean(await requireAdmin()) });
}

// 라우트 파일에서 그대로 내보내는 처리 함수들
export const GET = mapApi, POST = mapApi, PUT = mapApi, DELETE = mapApi;
