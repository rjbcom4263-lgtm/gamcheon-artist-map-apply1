import { requireAdmin } from "../../../admin/admin-auth";

// 지도 편집 앱(/map-app/studio/)이 운영자로 로그인해 있는지만 확인합니다. 다른 정보는 돌려주지 않습니다.
export async function GET() {
  const admin = await requireAdmin();
  return Response.json({ admin: Boolean(admin) }, { headers: { "cache-control": "no-store" } });
}
