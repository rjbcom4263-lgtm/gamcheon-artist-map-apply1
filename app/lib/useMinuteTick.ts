import { useEffect, useRef } from "react";

// 영업 시작·마감·자정처럼 시간이 지나면 달라지는 표시를 위해 1분마다 onTick을 부릅니다. 첫 화면은 서버가 계산한 값 그대로 두고,
// 백그라운드에서는 타이머가 늦어지므로 화면으로 돌아올 때도 부릅니다.
export function useMinuteTick(onTick: () => void) {
  const latest = useRef(onTick);
  useEffect(() => { latest.current = onTick; });

  useEffect(() => {
    const tick = () => latest.current();
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
