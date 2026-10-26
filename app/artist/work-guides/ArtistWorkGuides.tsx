"use client";

/* eslint-disable @next/next/no-img-element -- artwork thumbnails use the R2-backed image route. */
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { GuideRow } from "../../work-guides/db";
import type { SourceWork } from "../../work-guides/sources";

export default function ArtistWorkGuides({ sources, approved }: { sources: SourceWork[]; approved: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [guides, setGuides] = useState<GuideRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceIndex, setSourceIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const response = await fetch("/api/artist/work-guides", { cache: "no-store" });
    if (!response.ok) throw new Error("작품 목록을 불러오지 못했습니다.");
    const result = await response.json() as { guides: GuideRow[] };
    setGuides(result.guides);
  }
  useEffect(() => {
    fetch("/api/artist/work-guides", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("작품 목록을 불러오지 못했습니다."); return response.json() as Promise<{ guides: GuideRow[] }>; })
      .then((result) => setGuides(result.guides))
      .catch((error) => setMessage(String(error)))
      .finally(() => setLoading(false));
  }, []);

  function select(guide?: GuideRow) {
    setSelectedId(guide?.id || null);
    setTitle(guide?.pending_title || guide?.published_title || "");
    setDescription(guide?.pending_description || guide?.published_description || "");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSourceIndex(null);
    setMessage("");
  }

  function selectSource(source: SourceWork) {
    setSelectedId(null);
    setSourceIndex(source.index);
    setTitle(source.title);
    setDescription(source.description);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData();
    if (selectedId) form.set("id", selectedId);
    form.set("title", title);
    form.set("description", description);
    if (file) form.set("image", file);
    if (sourceIndex !== null) form.set("sourceIndex", String(sourceIndex));
    try {
      const response = await fetch("/api/artist/work-guides", { method: "POST", body: form });
      const result = await response.json() as { error?: string; id?: string };
      if (!response.ok) throw new Error(result.error || "검수 요청을 보내지 못했습니다.");
      await refresh();
      setSelectedId(result.id || null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSourceIndex(null);
      setMessage("검수 요청이 접수되었습니다. 운영진이 문구와 번역을 확인한 뒤 공개합니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "검수 요청을 보내지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function copyLink(id: string) {
    try { await navigator.clipboard.writeText(`${location.origin}/w/${id}`); setMessage("작품 주소를 복사했습니다. NFC 태그에도 이 주소를 기록하면 됩니다."); }
    catch { setMessage("주소를 복사하지 못했습니다. 작품 페이지를 열어 주소를 복사해 주세요."); }
  }

  const selected = guides.find((guide) => guide.id === selectedId);
  return <main className="artist-guides-page">
    <header><Link href="/artist">← 작가 관리 페이지</Link><span>GAMCHEON ARTISTS · ARTWORK STORY</span></header>
    <div className="artist-guides-intro"><div><span>작품 해설 관리</span><h1>작품마다 이야기를 남겨주세요.</h1><p>사진과 한국어 원문을 등록하면 운영진이 내용을 확인합니다. 공개 후에는 작품별 QR 주소를 사용할 수 있고, 같은 주소를 NFC 태그에 기록할 수 있습니다.</p></div><button type="button" onClick={() => select()}>+ 새 작품 추가</button></div>
    <div className="artist-guides-layout"><aside aria-label="등록한 작품"><h2>등록한 작품 <strong>{guides.length}</strong></h2>{loading ? <p>목록을 불러오는 중입니다.</p> : guides.length ? guides.map((guide) => <button type="button" key={guide.id} className={selectedId === guide.id ? "selected" : ""} onClick={() => select(guide)}><img src={`/api/work-guides/${guide.id}/image?variant=pending`} alt=""/><span><strong>{guide.pending_title || guide.published_title}</strong><small>{guide.pending_title ? guide.published_title ? "수정 검수 중 · 기존 해설 공개 중" : "운영진 검수 중" : "공개 중"}</small></span></button>) : <p>등록한 작품이 없습니다. 첫 작품을 추가해 보세요.</p>}{sources.length > 0 && <div className="artist-guide-sources"><h3>대표 작품에서 가져오기</h3>{sources.map((source) => <button type="button" key={source.index} onClick={() => selectSource(source)}><img src={`/api/artist/images?key=${encodeURIComponent(source.imageKey)}`} alt=""/><span>{source.title || `대표 작품 ${source.index + 1}`}</span></button>)}</div>}</aside>
      <section><h2>{selected ? "작품 해설 수정" : "새 작품 해설 등록"}</h2><p>작품명과 설명은 한국어 원문으로 적어주세요. 운영진이 문구를 다듬고 번역을 검수합니다.</p>{!approved && <p className="artist-guide-approval-note">작가 정보가 승인되면 작품 해설을 등록할 수 있습니다.</p>}<form onSubmit={(event) => void submit(event)}><label>작품명 <b>필수</b><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={150} placeholder="작품명을 입력해 주세요"/></label><label>작품 사진 {selected || sourceIndex !== null ? <small>새 사진을 선택하면 현재 사진을 교체 요청합니다.</small> : <b>필수</b>}<input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" required={!selected && sourceIndex === null} onChange={(event) => setFile(event.target.files?.[0] || null)}/></label>{selected && <img className="artist-guide-current-image" src={`/api/work-guides/${selected.id}/image?variant=pending`} alt="현재 작품 사진"/>}{!selected && sourceIndex !== null && <img className="artist-guide-current-image" src={`/api/artist/images?key=${encodeURIComponent(sources.find((source) => source.index === sourceIndex)?.imageKey || "")}`} alt="가져올 대표 작품 사진"/>}<label>작품 설명 <b>필수</b><textarea value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={3000} rows={9} placeholder="작품의 소재, 만든 과정, 관람객에게 전하고 싶은 이야기를 적어주세요."/></label><div className="artist-guide-actions"><span role="status">{message}</span><button type="submit" disabled={busy || !approved}>{busy ? "보내는 중…" : selected?.published_title ? "수정 검수 요청" : "운영진 검수 요청"}</button></div></form>
        {selected?.published_title && <div className="artist-guide-link-panel"><strong>공개된 작품 주소</strong><code>{`/w/${selected.id}`}</code><p>QR과 NFC는 이 주소를 함께 사용합니다. 수정 검수 중에도 기존 공개 해설을 볼 수 있습니다.</p><div><Link href={`/w/${selected.id}`} target="_blank">관람객 페이지 보기 ↗</Link><button type="button" onClick={() => void copyLink(selected.id)}>주소 복사</button><a href={`/api/work-guides/${selected.id}/qr`} download={`artwork-${selected.id}-qr.svg`}>QR 내려받기</a></div><img src={`/api/work-guides/${selected.id}/qr`} alt="작품 해설 QR 코드"/></div>}
      </section></div>
  </main>;
}
