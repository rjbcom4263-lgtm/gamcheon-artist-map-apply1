"use client";

import { useEffect } from "react";
import { statSeenKey, type StatKind } from "./lib/artist-stats";
import { todayInKorea } from "./lib/studio-hours";

// 페이지가 실제로 열렸을 때만 한 번 집계 신호를 보냅니다. 링크 미리 불러오기·검색 로봇은 세지 않고,
// 같은 브라우저는 하루 한 번만 셉니다(localStorage가 막혀 있으면 그냥 보냅니다).
export default function StatBeacon({ kind, id }: { kind: StatKind; id: string }) {
  useEffect(() => {
    const key = statSeenKey(kind, id, todayInKorea());
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch {}
    fetch("/api/stats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id }), keepalive: true }).catch(() => {});
  }, [kind, id]);
  return null;
}
