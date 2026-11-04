import { env } from "cloudflare:workers";
import { requireArtist } from "../../../admin/admin-auth";
import { EDITABLE_APPLICATION_QUERY } from "../../../artist/profile-editor-controls";
import { parse } from "../../../lib/json";
import { forbidden, redirectWithCookies } from "../../../lib/http";
import { readStudioHours, todayInKorea } from "../../../lib/studio-hours";

export const runtime = "edge";

type Application = { id: string; payload_json: string };

// 대시보드의 "오늘 임시 휴무" 버튼. 폼 POST라 JS 없이 동작하고 끝나면 작가 페이지로 돌아갑니다.
export async function POST(request: Request) {
  const artist = await requireArtist();
  if (!artist) return forbidden("로그인이 필요합니다.");
  const action = String((await request.formData()).get("action") || "");
  if (action !== "today" && action !== "clear") return redirectWithCookies("/artist#channels", []);

  const application = await env.DB.prepare(EDITABLE_APPLICATION_QUERY).bind(artist.accountId).first<Application>();
  const payload = application ? parse<Record<string, unknown>>(application.payload_json, {}) : {};
  const hours = readStudioHours(payload.studioHours);
  if (!application || !hours) return redirectWithCookies("/artist#channels", []);

  const today = todayInKorea();
  const studioHours = action === "today" ? { ...hours, closure: { from: today, until: today, note: hours.closure?.note || "" } } : { weekly: hours.weekly };
  await env.DB.prepare("UPDATE artist_applications SET payload_json = ? WHERE id = ? AND account_id = ? AND status = 'approved'")
    .bind(JSON.stringify({ ...payload, studioHours }), application.id, artist.accountId).run();
  return redirectWithCookies("/artist#channels", []);
}
