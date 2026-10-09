import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../admin/admin-auth";
import { cleanAlleys, cleanLines, ensureMapAlleyTables, readMapAlleys } from "../../../map/map-alleys-db";

export const runtime = "edge";

export async function GET() {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  return Response.json(await readMapAlleys(), { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!await requireAdmin()) return new Response("Forbidden", { status: 403 });
  try {
    const body = await request.json() as { alleys?: unknown; dismissed?: unknown };
    const alleys = cleanAlleys(body.alleys);
    const dismissed = cleanLines(body.dismissed ?? []);
    if (!alleys || !dismissed) {
      return Response.json({ error: "골목길은 감천 작업 범위 안에서 2~500개 점, 폭 1~8m로 지정해주세요." }, { status: 400 });
    }
    await ensureMapAlleyTables();
    await env.DB.prepare(`INSERT INTO map_alleys (id, alleys_json, dismissed_json, updated_at) VALUES ('active', ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET alleys_json = excluded.alleys_json, dismissed_json = excluded.dismissed_json, updated_at = CURRENT_TIMESTAMP`)
      .bind(JSON.stringify(alleys), JSON.stringify(dismissed)).run();
    return Response.json({ alleys, dismissed });
  } catch (error) {
    console.error("map alleys save failed", error);
    return Response.json({ error: "골목길을 저장하지 못했습니다." }, { status: 500 });
  }
}
