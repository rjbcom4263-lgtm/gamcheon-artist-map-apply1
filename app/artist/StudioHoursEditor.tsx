"use client";

import { DAYS, DAY_LABELS, defaultStudioHours, todayInKorea, type Day, type DayHours, type StudioHours } from "../lib/studio-hours";

/** 요일별 운영시간·임시 휴무 입력. hours가 null이면 예전처럼 글자 운영시간만 씁니다. */
export default function StudioHoursEditor({ hours, onChange }: { hours: StudioHours | null; onChange: (hours: StudioHours | null) => void }) {
  if (!hours) return <div className="studio-hours-editor is-empty">
    <p>요일별 시간을 넣으면 공개 페이지와 지도에 <b>지금 방문 가능 / 오늘 휴무</b>가 자동으로 표시됩니다.</p>
    <button type="button" onClick={() => onChange(defaultStudioHours())}>요일별 운영시간 설정하기</button>
  </div>;

  const setDay = (day: Day, patch: Partial<DayHours>) => onChange({ ...hours, weekly: { ...hours.weekly, [day]: { ...hours.weekly[day], ...patch } } });
  const firstOpen = DAYS.find((day) => !hours.weekly[day].closed);
  // 첫 영업일의 시간을 휴무가 아닌 모든 요일에 똑같이 적용
  const applyFirstToAll = () => firstOpen && onChange({ ...hours, weekly: Object.fromEntries(DAYS.map((day) => [day, hours.weekly[day].closed ? hours.weekly[day] : { ...hours.weekly[firstOpen] }])) as Record<Day, DayHours> });
  const today = todayInKorea();
  const closure = hours.closure;

  return <div className="studio-hours-editor">
    <div className="studio-hours-week">{DAYS.map((day) => {
      const item = hours.weekly[day];
      return <div className={`studio-hours-row${item.closed ? " is-closed" : ""}`} key={day}>
        <strong>{DAY_LABELS[day]}</strong>
        <label className="studio-hours-off"><input type="checkbox" checked={item.closed} onChange={(event) => setDay(day, { closed: event.target.checked })}/>휴무</label>
        {item.closed ? <span>정기 휴무</span> : <span className="studio-hours-times">
          <input type="time" aria-label={`${DAY_LABELS[day]}요일 여는 시간`} value={item.open} onChange={(event) => setDay(day, { open: event.target.value })}/>
          –
          <input type="time" aria-label={`${DAY_LABELS[day]}요일 닫는 시간`} value={item.close} onChange={(event) => setDay(day, { close: event.target.value })}/>
        </span>}
      </div>;
    })}</div>
    {firstOpen && <button type="button" className="studio-hours-copy" onClick={applyFirstToAll}>{DAY_LABELS[firstOpen]}요일 시간을 모든 영업일에 적용</button>}

    <div className="studio-hours-closure">
      <div><strong>임시 휴무</strong><small>기간 동안 공개 페이지·지도에 &lsquo;임시 휴무&rsquo;로 표시됩니다.</small></div>
      {closure ? <>
        <div className="studio-hours-dates">
          <input type="date" aria-label="임시 휴무 시작일" value={closure.from} onChange={(event) => onChange({ ...hours, closure: { ...closure, from: event.target.value } })}/>
          ~
          <input type="date" aria-label="임시 휴무 종료일" value={closure.until} min={closure.from} onChange={(event) => onChange({ ...hours, closure: { ...closure, until: event.target.value } })}/>
        </div>
        <input maxLength={100} placeholder="안내 문구 (예: 전시 준비로 쉬어요)" value={closure.note} onChange={(event) => onChange({ ...hours, closure: { ...closure, note: event.target.value } })}/>
        <button type="button" onClick={() => onChange({ weekly: hours.weekly })}>임시 휴무 없애기</button>
      </> : <div className="studio-hours-actions">
        <button type="button" onClick={() => onChange({ ...hours, closure: { from: today, until: today, note: "" } })}>임시 휴무 추가 (오늘부터)</button>
      </div>}
    </div>

    <button type="button" className="studio-hours-reset" onClick={() => onChange(null)}>요일별 시간 쓰지 않기</button>
  </div>;
}
