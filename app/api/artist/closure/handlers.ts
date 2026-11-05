import type { ApiContext } from "../../../lib/api-context";
import { EDITABLE_APPLICATION_QUERY } from "../../../artist/profile-editor-controls.ts";
import { parse } from "../../../lib/json.ts";
import { forbidden, redirectWithCookies } from "../../../lib/http.ts";
import { pendingClosure, readStudioHours, todayInKorea } from "../../../lib/studio-hours.ts";

type Application = { id: string; payload_json: string };

// 대시보드의 "오늘 임시 휴무" 버튼. 폼 POST라 JS 없이 동작하고 끝나면 작가 페이지로 돌아갑니다.
export async function changeClosure(request: Request, context: ApiContext) {
  const viewer = await context.session();
  if (viewer?.role !== "artist") return forbidden("로그인이 필요합니다.");
  const action = String((await request.formData()).get("action") || "");
  if (action !== "today" && action !== "clear") return redirectWithCookies("/artist#channels", []);

  const application = await context.DB.prepare(EDITABLE_APPLICATION_QUERY).bind(viewer.accountId).first<Application>();
  const payload = application ? parse<Record<string, unknown>>(application.payload_json, {}) : {};
  const hours = readStudioHours(payload.studioHours);
  if (!application || !hours) return redirectWithCookies("/artist#channels", []);

  // 휴무는 한 건만 저장하므로, 예약되었거나 진행 중인 휴무를 오늘 하루로 덮어쓰지 않습니다. 화면도 이때는 버튼을 보여 주지 않습니다.
  if (action === "today" && pendingClosure(hours)) return redirectWithCookies("/artist#channels", []);

  const today = todayInKorea();
  const studioHours = action === "today" ? { ...hours, closure: { from: today, until: today, note: "" } } : { weekly: hours.weekly };
  await context.DB.prepare("UPDATE artist_applications SET payload_json = ? WHERE id = ? AND account_id = ? AND status = 'approved'")
    .bind(JSON.stringify({ ...payload, studioHours }), application.id, viewer.accountId).run();
  return redirectWithCookies("/artist#channels", []);
}
