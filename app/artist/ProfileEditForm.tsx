"use client";

/* eslint-disable @next/next/no-img-element -- authenticated R2 images are rendered from the existing image API. */
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PublicArtist } from "../artists/public-artist";
import { Icon } from "../artists/[id]/ArtistDetail";
import { profileEditorControl } from "./profile-editor-controls";
import "../artists/[id]/artist-detail.css";
import "./visual-profile-editor.css";

type Work = { id?: string; title?: string; status?: string; description?: string };
type Payload = { values?: Record<string, unknown>; categories?: string[]; works?: Work[] };
type Panel = "profile" | "work" | "story" | "visit" | "channels" | null;
type Values = Record<string, string>;
const fields = ["tagline", "bio", "studioName", "address", "locationPrivacy", "visitType", "hours", "experience", "experienceDesc", "instagram", "website", "shopUrl"];
const statuses = ["판매 가능", "전시 작품", "문의 필요", "판매하지 않음"];

export default function ProfileEditForm({ applicationId, artist, payload, modal = false }: { applicationId: string; artist: PublicArtist; payload: Payload; modal?: boolean }) {
  const router = useRouter();
  const [artistName, setArtistName] = useState(artist.name);
  const [categories, setCategories] = useState((payload.categories || []).join(", "));
  const [values, setValues] = useState<Values>(Object.fromEntries(fields.map((key) => [key, typeof payload.values?.[key] === "string" ? String(payload.values[key]) : ""])));
  const [works, setWorks] = useState<Work[]>(payload.works || []);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [panel, setPanel] = useState<Panel>(null);
  const [workIndex, setWorkIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const ScrollContainer = modal ? "div" : "main";
  const categoryList = categories.split(",").map((item) => item.trim()).filter(Boolean);
  const update = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const workImage = (index: number) => previews[`workImage${index}`] || artist.works[index]?.image || "/assets/clone/hero-artist-studio.png";
  const publicAddress = values.locationPrivacy === "exact" && values.address ? values.address : "감천문화마을 일대";

  function pickImage(key: string, file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) return setMessage("이미지는 장당 2MB 이하로 선택해주세요.");
    const reader = new FileReader();
    reader.onload = () => setPreviews((current) => ({ ...current, [key]: String(reader.result || "") }));
    reader.readAsDataURL(file);
    setFiles((current) => ({ ...current, [key]: file }));
    setMessage("");
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData();
    form.set("applicationId", applicationId);
    form.set("profile", JSON.stringify({ artistName, categories: categoryList, values, works }));
    for (const [key, file] of Object.entries(files)) form.set(key, file);
    const response = await fetch("/api/artist/profile", { method: "PUT", body: form });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error || "저장하지 못했습니다.");
    setFiles({});
    setPreviews({});
    setMessage("공개 페이지에 반영했습니다.");
    router.refresh();
  }

  return <form className="artist-detail-page visual-editor-page" onSubmit={publish}>
    <div className="artist-detail-phone visual-editor-phone">
      <span className="artist-phone-speaker" aria-hidden="true"/>
      <ScrollContainer className="artist-detail-scroll">
        <div className="edit-mode-banner"><strong>편집 모드</strong><span>공개 반영 전까지 방문자에게 보이지 않습니다.</span></div>
        <header className="artist-detail-top">{modal ? <button {...profileEditorControl("hide")} aria-label="편집 팝업 닫기"><Icon name="back"/></button> : <Link href="/artist" aria-label="작가 관리 페이지로 돌아가기"><Icon name="back"/></Link>}<strong>내 공개 페이지</strong><Link href={`/artists/${encodeURIComponent(applicationId)}`} target="_blank" aria-label="현재 공개 페이지 보기">↗</Link></header>

        <section className="artist-profile-hero editable-section">
          <img src={previews.profileImage || artist.profile} alt={`${artistName} 작가 프로필`}/><div className="artist-hero-shade"/>
          <div className="artist-hero-copy"><span>{categoryList.join(" · ") || "작품 분야"}</span><h1>{artistName || "작가명"}</h1><p>{values.tagline || "작가 한 줄 소개"}</p></div>
          <button className="inline-edit-button" type="button" onClick={() => setPanel("profile")}>프로필 수정</button>
        </section>

        <section className="artist-profile-summary"><div><span>작품</span><strong>{works.length}<small>점</small></strong></div><div><span>분야</span><strong>{categoryList[0] || "예술"}</strong></div><div><span>작업실</span><strong>{values.studioName || "감천 작업실"}</strong></div></section>

        <section className="artist-work-section editable-section">
          <div className="artist-detail-heading"><div><span>WORK ARCHIVE</span><h2>대표 작품</h2></div><Icon name="grid"/></div>
          <button className="inline-edit-button section-edit" type="button" onClick={() => { setWorkIndex(0); setPanel("work"); }}>작품 수정</button>
          <div className="artist-work-grid">{works.map((work, index) => <button type="button" key={work.id || index} onClick={() => { setWorkIndex(index); setPanel("work"); }}><img src={workImage(index)} alt={work.title || `대표 작품 ${index + 1}`}/><span>{work.title || `대표 작품 ${index + 1}`}</span></button>)}</div>
        </section>

        <section className="artist-story-section editable-section"><span>ARTIST STORY</span><h2>작가의 이야기</h2><blockquote>“{values.tagline || "작가 한 줄 소개"}”</blockquote><p>{values.bio || "작가 이야기를 입력해주세요."}</p><button className="inline-edit-button section-edit light" type="button" onClick={() => setPanel("story")}>이야기 수정</button></section>

        <section className="artist-visit-section editable-section">
          <div className="artist-detail-heading"><div><span>STUDIO VISIT</span><h2>화실 방문 정보</h2></div></div><button className="inline-edit-button section-edit" type="button" onClick={() => setPanel("visit")}>방문 정보 수정</button>
          <dl><div><dt><Icon name="visit"/>작업실</dt><dd>{values.studioName || "감천 작업실"}</dd></div><div><dt><Icon name="pin"/>위치</dt><dd>{publicAddress}</dd></div><div><dt><Icon name="clock"/>운영시간</dt><dd>{values.hours || "방문 전 확인"}</dd></div><div><dt><Icon name="visit"/>방문 방식</dt><dd>{values.visitType || "방문 전 문의"}</dd></div></dl>
        </section>

        <section className="artist-channel-section editable-section"><span>작가 채널</span><button className="inline-edit-button section-edit" type="button" onClick={() => setPanel("channels")}>채널 수정</button><div>{values.instagram && <i>Instagram</i>}{values.website && <i>Website</i>}{values.shopUrl && <i>작품 구매</i>}{!values.instagram && !values.website && !values.shopUrl && <small>등록된 채널이 없습니다.</small>}</div></section>
      </ScrollContainer>

      <nav className="visual-editor-actions">{modal ? <button className="visual-editor-exit" {...profileEditorControl("hide")}>나가기</button> : <Link href="/artist">나가기</Link>}<span className={message ? (message.includes("반영") ? "is-ok" : "is-error") : ""} role="status">{message || "수정할 영역을 눌러보세요."}</span><button type="submit" disabled={saving}>{saving ? "반영 중…" : "공개 반영"}</button></nav>

      {panel && <section className="visual-edit-sheet" aria-label="공개 프로필 편집 패널"><header><div><span>LIVE PREVIEW</span><h2>{({ profile: "프로필 수정", work: "대표 작품 수정", story: "작가 이야기 수정", visit: "화실 방문 정보", channels: "온라인 채널" } as const)[panel]}</h2></div><button type="button" aria-label="편집 패널 닫기" onClick={() => setPanel(null)}>×</button></header><div className="visual-sheet-body">
        {panel === "profile" && <><Field label="작가명"><input required maxLength={100} value={artistName} onChange={(event) => setArtistName(event.target.value)}/></Field><Field label="작품 분야"><input required value={categories} placeholder="회화, 일러스트" onChange={(event) => setCategories(event.target.value)}/></Field><Field label="한 줄 소개"><textarea required maxLength={200} rows={3} value={values.tagline} onChange={(event) => update("tagline", event.target.value)}/></Field><ImagePicker label="프로필 이미지" preview={previews.profileImage || artist.profile} onChange={(file) => pickImage("profileImage", file)}/></>}
        {panel === "work" && <><div className="work-selector">{works.map((_, index) => <button className={index === workIndex ? "is-active" : ""} type="button" key={index} onClick={() => setWorkIndex(index)}>{index + 1}</button>)}</div><ImagePicker label="작품 이미지" preview={workImage(workIndex)} onChange={(file) => pickImage(`workImage${workIndex}`, file)}/><Field label="작품명"><input required maxLength={150} value={works[workIndex]?.title || ""} onChange={(event) => setWorks((current) => current.map((item, index) => index === workIndex ? { ...item, title: event.target.value } : item))}/></Field><Field label="작품 상태"><select value={works[workIndex]?.status || "문의 필요"} onChange={(event) => setWorks((current) => current.map((item, index) => index === workIndex ? { ...item, status: event.target.value } : item))}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></Field><Field label="작품 설명"><textarea maxLength={1200} rows={4} value={works[workIndex]?.description || ""} onChange={(event) => setWorks((current) => current.map((item, index) => index === workIndex ? { ...item, description: event.target.value } : item))}/></Field></>}
        {panel === "story" && <Field label="작가 이야기"><textarea maxLength={4000} rows={9} value={values.bio} onChange={(event) => update("bio", event.target.value)}/></Field>}
        {panel === "visit" && <><Field label="작업실 이름"><input maxLength={150} value={values.studioName} onChange={(event) => update("studioName", event.target.value)}/></Field><Field label="주소"><input maxLength={300} value={values.address} onChange={(event) => update("address", event.target.value)}/></Field><Field label="주소 공개 범위"><select value={values.locationPrivacy || "nearby"} onChange={(event) => update("locationPrivacy", event.target.value)}><option value="exact">정확한 주소 공개</option><option value="nearby">감천문화마을 일대로 표시</option><option value="reservation">예약 방문객에게만 안내</option></select></Field><Field label="운영시간"><textarea maxLength={500} rows={3} value={values.hours} onChange={(event) => update("hours", event.target.value)}/></Field><Field label="방문 방식"><select value={values.visitType} onChange={(event) => update("visitType", event.target.value)}>{["자유 방문 가능", "운영시간 내 방문 가능", "사전 예약 필요", "일반 방문 불가"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="체험 프로그램"><select value={values.experience} onChange={(event) => update("experience", event.target.value)}>{["없음", "있음", "준비 중"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="체험 설명"><textarea maxLength={1000} rows={3} value={values.experienceDesc} onChange={(event) => update("experienceDesc", event.target.value)}/></Field></>}
        {panel === "channels" && <><Field label="Instagram"><input type="url" value={values.instagram} placeholder="https://instagram.com/..." onChange={(event) => update("instagram", event.target.value)}/></Field><Field label="홈페이지"><input type="url" value={values.website} placeholder="https://..." onChange={(event) => update("website", event.target.value)}/></Field><Field label="온라인 판매처"><input type="url" value={values.shopUrl} placeholder="https://..." onChange={(event) => update("shopUrl", event.target.value)}/></Field></>}
      </div><footer><span>입력 내용이 화면에 바로 미리보기 됩니다.</span><button type="button" onClick={() => setPanel(null)}>미리보기 적용</button></footer></section>}
    </div>
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="visual-field"><span>{label}</span>{children}</label>; }
function ImagePicker({ label, preview, onChange }: { label: string; preview: string; onChange: (file?: File) => void }) { return <label className="visual-image-picker"><span>{label}</span><div><img src={preview} alt="이미지 미리보기"/><strong>사진 교체<small>최대 2MB</small></strong></div><input type="file" accept="image/*" onChange={(event) => onChange(event.target.files?.[0])}/></label>; }
