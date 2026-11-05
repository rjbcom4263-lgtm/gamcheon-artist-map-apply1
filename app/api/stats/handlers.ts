import { findPublicArtist } from "../../artists/public-artist-query.ts";
import type { ApiContext } from "../../lib/api-context";
import { todayInKorea } from "../../lib/studio-hours.ts";
import { findPublicGuide } from "../../work-guides/public-guide.ts";

const done = () => new Response(null, { status: 204 });

// 공개 작가 페이지·작품 해설(QR) 페이지가 열린 뒤 브라우저가 보내는 집계 신호(app/StatBeacon.tsx).
// 하루 합계만 올리고 방문자 정보는 저장하지 않습니다. 작가 본인·운영자가 본 것은 세지 않습니다.
export async function recordStat(request: Request, context: ApiContext) {
  const body = await request.json().catch(() => ({})) as { kind?: unknown; id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  let applicationId = "";
  let ownerId = "";
  let target = "";
  if (body.kind === "view" && /^GA-\d{8}-[A-F0-9]{6}$/.test(id)) {
    const row = await findPublicArtist(context.DB, id);
    if (!row) return done();
    applicationId = id;
    ownerId = row.account_id;
  } else if (body.kind === "qr" && /^WG-[0-9a-f-]{36}$/.test(id)) {
    const guide = await findPublicGuide(context.DB, id);
    if (!guide) return done();
    applicationId = guide.application_id;
    ownerId = guide.account_id;
    target = id;
  } else return done();

  const viewer = await context.session();
  if (viewer && (viewer.role === "admin" || viewer.accountId === ownerId)) return done();

  await context.DB.prepare(`INSERT INTO artist_daily_stats (application_id, day, kind, target, count) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (application_id, day, kind, target) DO UPDATE SET count = count + 1`)
    .bind(applicationId, todayInKorea(), body.kind, target).run();
  return done();
}
