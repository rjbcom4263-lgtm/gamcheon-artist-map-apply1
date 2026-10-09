import { requireAdmin } from "../../../admin/admin-auth";

export const runtime = "edge";

// 지도(공개 지도 iframe·골목지도 작업실)가 관리자로 로그인해 있는지만 확인합니다. 관리자면 걸은 길을 자동으로
// 기록해 골목길 후보를 찾는 데 씁니다(/api/admin/gps-trails). 다른 정보는 돌려주지 않습니다.
export async function GET() {
  const admin = await requireAdmin();
  return Response.json({ admin: Boolean(admin) }, { headers: { "cache-control": "no-store" } });
}
