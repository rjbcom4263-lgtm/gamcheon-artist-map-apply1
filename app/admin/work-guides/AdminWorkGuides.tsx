"use client";

/* eslint-disable @next/next/no-img-element -- artwork thumbnails use the R2-backed image route. */
import Link from "next/link";
import { useEffect, useState } from "react";
import type { GuideRow } from "../../work-guides/db";
import { GUIDE_LANGUAGES, type Translation } from "../../work-guides/shared";

export default function AdminWorkGuides() {
  const [guides, setGuides] = useState<GuideRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const selected = guides.find((guide) => guide.id === selectedId);
  const pendingCount = guides.filter((guide) => guide.pending_title).length;

  function select(guide: GuideRow) {
    setSelectedId(guide.id);
    setTitle(guide.pending_title || guide.published_title || "");
    setDescription(guide.pending_description || guide.published_description || "");
    try { setTranslations(JSON.parse(guide.translations_json) as Record<string, Translation>); } catch { setTranslations({}); }
    setMessage("");
  }

  async function refresh() {
    const response = await fetch("/api/admin/work-guides", { cache: "no-store" });
    if (!response.ok) throw new Error("검수 목록을 불러오지 못했습니다.");
    const result = await response.json() as { guides: GuideRow[] };
    setGuides(result.guides);
    if (!selectedId && result.guides.length) select(result.guides[0]);
  }
  useEffect(() => {
    fetch("/api/admin/work-guides", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("검수 목록을 불러오지 못했습니다."); return response.json() as Promise<{ guides: GuideRow[] }>; })
      .then((result) => {
        setGuides(result.guides);
        const first = result.guides[0];
        if (!first) return;
        setSelectedId(first.id);
        setTitle(first.pending_title || first.published_title || "");
        setDescription(first.pending_description || first.published_description || "");
        try { setTranslations(JSON.parse(first.translations_json) as Record<string, Translation>); } catch { setTranslations({}); }
      })
      .catch((error) => setMessage(String(error)))
      .finally(() => setLoading(false));
  }, []);

  function updateTranslation(code: string, field: keyof Translation, value: string) {
    setTranslations((current) => ({ ...current, [code]: { title: current[code]?.title || "", description: current[code]?.description || "", [field]: value } }));
  }

  async function publish() {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/work-guides/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, description, translations, revision: selected.pending_revision }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "해설을 공개하지 못했습니다.");
      await refresh();
      setMessage("검수가 완료되어 작품 해설이 공개되었습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "해설을 공개하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(`${location.origin}/w/${selected.id}`); setMessage("작품 주소를 복사했습니다. QR과 NFC에 같은 주소를 사용합니다."); }
    catch { setMessage("주소를 복사하지 못했습니다. 작품 페이지를 열어 주소를 복사해 주세요."); }
  }

  return <main className="dash-main admin-guide-main"><header className="dash-top"><div><p>ARTWORK STORY</p><h1>작품 해설 검수</h1><span>작가 원문을 다듬고, 번역을 확인한 뒤 공개합니다.</span></div><strong className="admin-guide-count">검수 대기 {pendingCount}건</strong></header>
    <div className="admin-guide-layout"><aside aria-label="작품 목록"><h2>작품 목록</h2>{loading ? <p>불러오는 중입니다.</p> : guides.length ? guides.map((guide) => <button key={guide.id} type="button" className={guide.id === selectedId ? "selected" : ""} onClick={() => select(guide)}><strong>{guide.pending_title || guide.published_title}</strong><small>{guide.artist_name} · {guide.pending_title ? "검수 대기" : "공개 중"}</small></button>) : <p>검수할 작품이 없습니다.</p>}</aside>
      <section>{selected ? <><div className="admin-guide-work"><img src={`/api/work-guides/${selected.id}/image?variant=pending`} alt={`${title} 작품 사진`}/><div><span>{selected.artist_name} 작가</span><h2>{selected.pending_title || selected.published_title}</h2><p>{selected.pending_title ? "새 검수 요청이 있습니다." : "현재 공개된 작품 해설입니다."}</p></div></div><label>공개할 작품명<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={150}/></label><label>한국어 해설<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={8} maxLength={3000}/></label><h3>번역 해설</h3><p className="admin-guide-hint">검수를 마친 언어만 제목과 설명을 함께 입력하세요. 빈 언어는 관람객에게 표시되지 않습니다.</p>{GUIDE_LANGUAGES.map(({ code, label }) => <div className="admin-guide-language" key={code}><strong>{label}</strong><label>번역 제목<input value={translations[code]?.title || ""} onChange={(event) => updateTranslation(code, "title", event.target.value)} maxLength={150}/></label><label>번역 설명<textarea value={translations[code]?.description || ""} onChange={(event) => updateTranslation(code, "description", event.target.value)} rows={4} maxLength={3000}/></label></div>)}<div className="admin-guide-actions"><span role="status">{message}</span><button type="button" onClick={() => void publish()} disabled={busy}>{busy ? "공개 중…" : selected.pending_title ? "검수 완료·공개" : "공개 해설 수정"}</button></div>{selected.published_title && <div className="admin-guide-published"><strong>작품 고유 주소</strong><code>{`/w/${selected.id}`}</code><p>QR과 NFC 태그에 이 주소를 사용합니다.</p><div><button type="button" onClick={() => void copyLink()}>주소 복사</button><Link href={`/w/${selected.id}`} target="_blank">관람객 페이지 보기 ↗</Link><a href={`/api/work-guides/${selected.id}/qr`} download={`artwork-${selected.id}-qr.svg`}>QR 내려받기</a></div><img src={`/api/work-guides/${selected.id}/qr`} alt="작품 해설 QR 코드"/></div>}</> : <p className="admin-guide-empty">왼쪽에서 작품을 선택해 주세요.</p>}</section>
    </div>
  </main>;
}
