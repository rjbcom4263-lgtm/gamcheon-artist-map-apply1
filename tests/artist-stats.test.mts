import assert from "node:assert/strict";
import { test } from "node:test";
import { koreaDay, statSeenKey, summarizeStats, type StatRow } from "../app/lib/artist-stats.ts";

// 2026-11-04 12:00 한국 시간
const now = new Date("2026-11-04T12:00:00+09:00");

test("한국 날짜 기준으로 n일 전 날짜를 구한다", () => {
  assert.equal(koreaDay(0, now), "2026-11-04");
  assert.equal(koreaDay(6, now), "2026-10-29");
  // UTC로는 11/3 16:00이지만 한국은 11/4 01:00
  assert.equal(koreaDay(0, new Date("2026-11-03T16:00:00Z")), "2026-11-04");
});

test("7일·30일 합계, 14일 막대, QR 많이 찍힌 작품을 묶는다", () => {
  const rows: StatRow[] = [
    { day: "2026-11-04", kind: "view", target: "", count: 3 },
    { day: "2026-11-04", kind: "qr", target: "WG-a", count: 2 },
    { day: "2026-10-29", kind: "view", target: "", count: 1 },  // 7일 안(6일 전)
    { day: "2026-10-28", kind: "view", target: "", count: 5 },  // 7일 밖, 30일 안
    { day: "2026-10-20", kind: "qr", target: "WG-b", count: 4 },
    { day: "2026-10-01", kind: "view", target: "", count: 99 }, // 30일 밖
  ];
  const stats = summarizeStats(rows, now);
  assert.deepEqual({ views7: stats.views7, views30: stats.views30, qr7: stats.qr7, qr30: stats.qr30 }, { views7: 4, views30: 9, qr7: 2, qr30: 6 });
  assert.equal(stats.days.length, 14);
  assert.equal(stats.days[0].day, "2026-10-22");
  assert.deepEqual(stats.days.at(-1), { day: "2026-11-04", views: 3, qr: 2 });
  assert.deepEqual(stats.topGuides, [{ target: "WG-b", count: 4 }, { target: "WG-a", count: 2 }]);
});

test("기록이 없으면 모두 0이고 막대는 빈 날짜로 채운다", () => {
  const stats = summarizeStats([], now);
  assert.equal(stats.views30 + stats.qr30, 0);
  assert.ok(stats.days.every((day) => day.views === 0 && day.qr === 0));
  assert.equal(statSeenKey("qr", "WG-a", "2026-11-04"), "gamcheon-stat:qr:WG-a:2026-11-04");
});
