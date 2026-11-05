import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { formatDateTime } from "../app/lib/format.ts";

// 서버(Cloudflare Worker)는 UTC로, 방문자 브라우저는 자기 시간대로 돕니다. 어느 쪽에서 그려도 같은 한국 시각이어야
// 서버 화면이 어긋나지 않고 React 하이드레이션 오류(#418)도 나지 않습니다.
const originalTimeZone = process.env.TZ;
afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

for (const timeZone of ["UTC", "Asia/Seoul", "America/New_York"]) {
  test(`${timeZone}에서 그려도 D1 시각을 한국 시각으로 보여 준다`, () => {
    process.env.TZ = timeZone;
    assert.equal(formatDateTime("2026-11-05 00:30:00"), "2026. 11. 5. 오전 9:30");
  });

  test(`${timeZone}에서 그려도 한국 날짜가 바뀌는 시각을 맞춘다`, () => {
    process.env.TZ = timeZone;
    assert.equal(formatDateTime("2026-11-05 15:30:00"), "2026. 11. 6. 오전 12:30");
  });
}

test("Z가 붙은 시각도 같은 시각으로 읽는다", () => {
  process.env.TZ = "UTC";
  assert.equal(formatDateTime("2026-11-05T00:30:00Z"), "2026. 11. 5. 오전 9:30");
});

test("값이 없으면 줄표를 보여 준다", () => {
  assert.equal(formatDateTime(null), "-");
  assert.equal(formatDateTime(undefined), "-");
  assert.equal(formatDateTime(""), "-");
});
