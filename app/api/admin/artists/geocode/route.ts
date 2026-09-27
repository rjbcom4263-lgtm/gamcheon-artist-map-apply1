import { requireAdmin } from "../../../../admin/admin-auth";

export const runtime = "edge";

type KakaoAddress = { address_name?: string; x?: string; y?: string; road_address?: { address_name?: string } | null };

export async function POST(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: "권한이 없습니다." }, { status: 403 });
  const body = await request.json().catch(() => null) as { query?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (query.length < 4 || query.length > 200) return Response.json({ error: "공방 주소를 4자 이상 입력해주세요." }, { status: 400 });
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return Response.json({ error: "주소 검색 키가 설정되지 않았습니다. 지도에서 직접 위치를 지정해주세요." }, { status: 503 });

  try {
    const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
    url.searchParams.set("query", query);
    url.searchParams.set("size", "5");
    const response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store" });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { code?: number } | null;
      const detail = failure?.code === -3
        ? "카카오 개발자 앱에서 카카오맵 API 사용을 활성화해주세요."
        : response.status === 403
          ? "카카오 주소 검색이 거부됐습니다. 앱의 API 권한과 호출 허용 IP 설정을 확인해주세요."
        : `카카오 주소 검색 응답 ${response.status}${failure?.code === undefined ? "" : ` (코드 ${failure.code})`}.`;
      return Response.json({ error: `${detail} 지도에서 직접 위치를 지정할 수 있습니다.` }, { status: 502 });
    }
    const data = await response.json() as { documents?: KakaoAddress[] };
    const suggestions = (data.documents || []).flatMap((item) => {
      const longitude = Number(item.x);
      const latitude = Number(item.y);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)
        || longitude < 128.9998 || longitude > 129.0174 || latitude < 35.0867 || latitude > 35.1023) return [];
      return [{ address: item.road_address?.address_name || item.address_name || query, longitude, latitude }];
    });
    return Response.json({ suggestions }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "주소 검색에 실패했습니다. 지도에서 직접 위치를 지정할 수 있습니다." }, { status: 502 });
  }
}
