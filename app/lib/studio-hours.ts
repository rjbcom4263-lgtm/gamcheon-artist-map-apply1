// 작업실 요일별 운영시간·임시 휴무. 신청서 payload_json의 studioHours에 저장합니다(DB 칸 추가 없음).
// 시간 계산은 한국 시간(UTC+9, 서머타임 없음) 기준입니다.

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = typeof DAYS[number];
export const DAY_LABELS: Record<Day, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };

export type DayHours = { closed: boolean; open: string; close: string };
export type StudioClosure = { from: string; until: string; note: string };
export type StudioHours = { weekly: Record<Day, DayHours>; closure?: StudioClosure };
export type StudioState = "open" | "before" | "after" | "dayoff" | "closure" | "reservation" | "noVisit";
export type StudioStatus = { state: StudioState; label: string; detail: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KST_OFFSET = 9 * 60 * 60 * 1000;

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export function defaultStudioHours(): StudioHours {
  return { weekly: Object.fromEntries(DAYS.map((day) => [day, { closed: day === "mon", open: "10:00", close: "18:00" }])) as Record<Day, DayHours> };
}

/** 입력값을 검사해 저장할 형태로 정리합니다. 형식이 틀리면 오류 문구를 돌려줍니다. */
export function sanitizeStudioHours(value: unknown): StudioHours | { error: string } {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const weeklyRaw = raw.weekly && typeof raw.weekly === "object" ? raw.weekly as Record<string, unknown> : {};
  const weekly = {} as Record<Day, DayHours>;
  for (const day of DAYS) {
    const item = weeklyRaw[day] && typeof weeklyRaw[day] === "object" ? weeklyRaw[day] as Record<string, unknown> : {};
    const closed = item.closed === true;
    const open = text(item.open, 5);
    const close = text(item.close, 5);
    if (!closed && (!TIME.test(open) || !TIME.test(close) || close <= open)) return { error: `${DAY_LABELS[day]}요일 운영시간을 확인해주세요. 닫는 시간은 여는 시간보다 늦어야 합니다.` };
    weekly[day] = { closed, open: TIME.test(open) ? open : "10:00", close: TIME.test(close) ? close : "18:00" };
  }
  const closureRaw = raw.closure && typeof raw.closure === "object" ? raw.closure as Record<string, unknown> : null;
  if (!closureRaw) return { weekly };
  const from = text(closureRaw.from, 10);
  const until = text(closureRaw.until, 10);
  if (!DATE.test(from) || !DATE.test(until) || until < from) return { error: "임시 휴무 기간을 확인해주세요." };
  return { weekly, closure: { from, until, note: text(closureRaw.note, 100) } };
}

/** 저장된 값을 읽습니다. 없거나 깨진 값이면 undefined(예전처럼 글자 운영시간만 사용). */
export function readStudioHours(value: unknown): StudioHours | undefined {
  if (!value) return undefined;
  const result = sanitizeStudioHours(value);
  return "error" in result ? undefined : result;
}

function kst(now: Date) {
  const shifted = new Date(now.getTime() + KST_OFFSET);
  return { date: shifted.toISOString().slice(0, 10), day: DAYS[(shifted.getUTCDay() + 6) % 7], time: shifted.toISOString().slice(11, 16) };
}

export function todayInKorea(now = new Date()) { return kst(now).date; }

function shortDate(date: string) { return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`; }

/** 요일별 시간을 "월 휴무 · 화–금 10:00–18:00 · 토–일 11:00–17:00"처럼 줄여 씁니다. */
export function formatWeekly(hours: StudioHours) {
  const groups: Array<{ days: Day[]; value: string }> = [];
  for (const day of DAYS) {
    const item = hours.weekly[day];
    const value = item.closed ? "휴무" : `${item.open}–${item.close}`;
    const last = groups.at(-1);
    if (last && last.value === value) last.days.push(day);
    else groups.push({ days: [day], value });
  }
  return groups.map(({ days, value }) => `${DAY_LABELS[days[0]]}${days.length > 1 ? `–${DAY_LABELS[days.at(-1)!]}` : ""} ${value}`).join(" · ");
}

/** 지금 방문할 수 있는지 계산합니다. 임시 휴무 > 방문 방식 > 요일별 시간 순서로 봅니다. */
export function studioStatus(hours: StudioHours, visitType: string, now = new Date()): StudioStatus {
  const today = kst(now);
  const closure = hours.closure;
  if (closure && closure.from <= today.date && today.date <= closure.until) {
    const period = closure.from === closure.until ? "오늘" : `${shortDate(closure.until)}까지`;
    return { state: "closure", label: "임시 휴무", detail: `${period} 쉬어요${closure.note ? ` · ${closure.note}` : ""}` };
  }
  if (visitType === "일반 방문 불가") return { state: "noVisit", label: "방문 불가", detail: "작업실 일반 방문을 받지 않아요" };
  const day = hours.weekly[today.day];
  const todayText = day.closed ? "오늘 정기 휴무" : `오늘 ${day.open}–${day.close}`;
  if (visitType === "사전 예약 필요") return { state: "reservation", label: "예약 방문", detail: `${todayText} · 사전 예약 후 방문` };
  if (day.closed) return { state: "dayoff", label: "오늘 휴무", detail: nextOpening(hours, today.day) };
  if (today.time < day.open) return { state: "before", label: "영업 전", detail: `${day.open}에 열어요` };
  if (today.time >= day.close) return { state: "after", label: "영업 종료", detail: nextOpening(hours, today.day) };
  return { state: "open", label: "방문 가능", detail: `${day.close}까지` };
}

function nextOpening(hours: StudioHours, from: Day) {
  const start = DAYS.indexOf(from);
  for (let step = 1; step <= 7; step += 1) {
    const day = DAYS[(start + step) % 7];
    const item = hours.weekly[day];
    if (!item.closed) return `${step === 1 ? "내일" : `${DAY_LABELS[day]}요일`} ${item.open}에 열어요`;
  }
  return "운영일이 정해지지 않았어요";
}
