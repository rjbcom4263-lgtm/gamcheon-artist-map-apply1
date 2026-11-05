// 작가 페이지 조회·QR 스캔 하루 합계를 대시보드용으로 묶습니다. 테이블은 migrations/0003_artist_daily_stats.sql.
import { todayInKorea } from "./studio-hours.ts";

export type StatKind = "view" | "qr";
export type StatRow = { day: string; kind: StatKind; target: string; count: number };
export type StatDay = { day: string; views: number; qr: number };
export type ArtistStats = { views7: number; views30: number; qr7: number; qr30: number; days: StatDay[]; topGuides: Array<{ target: string; count: number }> };

export const STAT_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 오늘(한국 시간)부터 거꾸로 n일 전 날짜. */
export function koreaDay(daysAgo: number, now = new Date()) {
  return todayInKorea(new Date(now.getTime() - daysAgo * DAY_MS));
}

export function summarizeStats(rows: StatRow[], now = new Date(), chartDays = 14): ArtistStats {
  const since7 = koreaDay(6, now);
  const since30 = koreaDay(STAT_WINDOW_DAYS - 1, now);
  const byDay = new Map<string, StatDay>();
  const guides = new Map<string, number>();
  const totals = { views7: 0, views30: 0, qr7: 0, qr30: 0 };
  for (const row of rows) {
    if (row.day < since30) continue;
    const count = Number(row.count) || 0;
    const recent = row.day >= since7;
    const day = byDay.get(row.day) || { day: row.day, views: 0, qr: 0 };
    if (row.kind === "view") { day.views += count; totals.views30 += count; if (recent) totals.views7 += count; }
    else { day.qr += count; totals.qr30 += count; if (recent) totals.qr7 += count; if (row.target) guides.set(row.target, (guides.get(row.target) || 0) + count); }
    byDay.set(row.day, day);
  }
  const days = Array.from({ length: chartDays }, (_, index) => {
    const day = koreaDay(chartDays - 1 - index, now);
    return byDay.get(day) || { day, views: 0, qr: 0 };
  });
  const topGuides = [...guides].map(([target, count]) => ({ target, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  return { ...totals, days, topGuides };
}

/** 같은 브라우저에서 하루 한 번만 세기 위한 localStorage 키. */
export function statSeenKey(kind: StatKind, id: string, day: string) {
  return `gamcheon-stat:${kind}:${id}:${day}`;
}

type SeenStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * 하루 한 번만 신호를 보냅니다. 중복을 막으려고 보내기 전에 표시하고, 실패하면 지워 다음 방문 때 다시 보냅니다.
 * 저장 공간이 막혀 있으면(getStore가 오류) 그냥 보냅니다.
 */
export async function recordStatOnce(key: string, getStore: () => SeenStore, send: () => Promise<{ ok: boolean }>) {
  try {
    const store = getStore();
    if (store.getItem(key)) return;
    store.setItem(key, "1");
  } catch {}
  const ok = await send().then((response) => response.ok, () => false);
  if (ok) return;
  try { getStore().removeItem(key); } catch {}
}
