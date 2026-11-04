-- 작가 공개 페이지 조회·작품 해설 QR 스캔 하루 합계 (app/lib/artist-stats.ts, app/api/stats/route.ts).
-- 방문자 정보(IP·기기·계정)는 남기지 않고 작가·날짜(한국 시간)·종류별 횟수만 셉니다.
-- kind: 'view' = /artists/{id} 조회, 'qr' = /w/{작품 해설 id} 열람(QR로만 들어오는 페이지). target은 qr일 때 작품 해설 id.
CREATE TABLE IF NOT EXISTS artist_daily_stats (
  application_id TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('view', 'qr')),
  target TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (application_id, day, kind, target)
);
CREATE INDEX IF NOT EXISTS idx_artist_daily_stats_day ON artist_daily_stats (application_id, day);
