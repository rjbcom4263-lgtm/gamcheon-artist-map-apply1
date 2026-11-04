import type { ArtistStats } from "../lib/artist-stats";

const shortDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

/** 작가 대시보드의 방문 통계 카드. 하루 합계(최근 30일)만 보여줍니다. */
export default function StatsCard({ stats, guideTitles }: { stats: ArtistStats; guideTitles: Record<string, string> }) {
  const max = Math.max(1, ...stats.days.flatMap((day) => [day.views, day.qr]));
  const empty = !stats.views30 && !stats.qr30;
  return <section className="artist-card artist-stats-card" id="stats">
    <div className="artist-card-head"><div><p>VISITOR STATS</p><h2>방문 통계</h2></div><span>최근 30일 · 작가 본인·운영자 방문 제외</span></div>
    <div className="artist-stats-numbers">
      <article><span>공개 페이지 조회</span><strong>{stats.views7.toLocaleString()}<em>회 · 7일</em></strong><small>30일 {stats.views30.toLocaleString()}회</small></article>
      <article><span>작품 QR 스캔</span><strong>{stats.qr7.toLocaleString()}<em>회 · 7일</em></strong><small>30일 {stats.qr30.toLocaleString()}회</small></article>
    </div>
    {empty ? <p className="artist-stats-empty">아직 집계된 방문이 없습니다. 방문객이 공개 페이지를 열거나 작품 QR을 찍으면 바로 반영됩니다.</p> : <>
      <div className="artist-stats-legend" aria-hidden="true"><span><i className="is-view"/>페이지 조회</span><span><i className="is-qr"/>QR 스캔</span></div>
      <div className="artist-stats-chart" role="img" aria-label={`최근 ${stats.days.length}일 일별 페이지 조회와 QR 스캔. 아래 표로 보기에서 숫자를 확인할 수 있습니다.`}>
        {stats.days.map((day) => <div className="artist-stats-day" key={day.day} title={`${shortDay(day.day)} · 조회 ${day.views}회 · QR ${day.qr}회`}>
          <div className="artist-stats-bars"><i className="is-view" style={{ height: `${(day.views / max) * 100}%` }}/><i className="is-qr" style={{ height: `${(day.qr / max) * 100}%` }}/></div>
          <small>{shortDay(day.day)}</small>
        </div>)}
      </div>
      <details className="artist-stats-table"><summary>표로 보기</summary><table><thead><tr><th>날짜</th><th>조회</th><th>QR</th></tr></thead><tbody>{[...stats.days].reverse().map((day) => <tr key={day.day}><td>{shortDay(day.day)}</td><td>{day.views}</td><td>{day.qr}</td></tr>)}</tbody></table></details>
      {stats.topGuides.length > 0 && <div className="artist-stats-top"><strong>QR이 많이 찍힌 작품 (30일)</strong><ol>{stats.topGuides.map((guide) => <li key={guide.target}><span>{guideTitles[guide.target] || "작품 해설"}</span><b>{guide.count}회</b></li>)}</ol></div>}
    </>}
  </section>;
}
