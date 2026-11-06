"use client";

/* eslint-disable @next/next/no-img-element -- authenticated R2 images are rendered from the existing image API. */
import { FormEvent, useState } from "react";
import { LOCATION_PRIVACY_CHOICES } from "../lib/location-privacy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PublicArtist } from "../artists/public-artist";
import type { ArtistExperience } from "./profile-data";
import { Icon, StatusBadge, StudioGallery } from "../artists/[id]/ArtistDetail";
import { profileEditorControl } from "./profile-editor-controls";
import "../artists/[id]/artist-detail.css";
import "./visual-profile-editor.css";
import { MAX_IMAGE_BYTES } from "../lib/application";
import { formatWeekly, studioStatus, type StudioHours } from "../lib/studio-hours";
import StudioHoursEditor from "./StudioHoursEditor";
import { compressImage } from "../lib/image-client";
import { MAX_GALLERY_CAPTION, MAX_GALLERY_PHOTOS } from "../lib/studio-gallery";

type Work = { id?: string; title?: string; status?: string; description?: string };
type Payload = { values?: Record<string, unknown>; categories?: string[]; works?: Work[] };
type Panel = "profile" | "work" | "story" | "visit" | "gallery" | "channels" | null;
/** 편집 중인 작업실 사진 한 장. key가 있으면 이미 저장된 사진, file이 있으면 새로 올릴 사진. */
type GalleryDraft = { id: string; key?: string; file?: File; image: string; caption: string };
const photoUrl = (key: string) => `/api/artists/images?key=${encodeURIComponent(key)}`;
type Values = Record<string, string>;
const fields = ["tagline", "bio", "studioName", "address", "locationPrivacy", "visitType", "hours", "experience", "experienceDesc", "instagram", "website", "shopUrl"];
const statuses = ["판매 가능", "전시 작품", "문의 필요", "판매하지 않음"];

export default function ProfileEditForm({ applicationId, artist, payload, modal = false }: { applicationId: string; artist: PublicArtist; payload: Payload; modal?: boolean }) {
  const router = useRouter();
  const [artistName, setArtistName] = useState(artist.name);
  const [categories, setCategories] = useState((payload.categories || []).join(", "));
  const [values, setValues] = useState<Values>(Object.fromEntries(fields.map((key) => [key, typeof payload.values?.[key] === "string" ? String(payload.values[key]) : ""])));
  const [works, setWorks] = useState<Work[]>(payload.works || []);
  const [experiences, setExperiences] = useState<ArtistExperience[]>(artist.experiences);
  const [studioHours, setStudioHours] = useState<StudioHours | null>(artist.studioHours || null);
  const [gallery, setGallery] = useState<GalleryDraft[]>(artist.gallery.map((photo) => ({ id: photo.key, key: photo.key, image: photo.image, caption: photo.caption })));
  const [files, setFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [panel, setPanel] = useState<Panel>(null);
  const [workIndex, setWorkIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [preparingPhotos, setPreparingPhotos] = useState(0);
  const [message, setMessage] = useState("");
  const ScrollContainer = modal ? "div" : "main";
  const categoryList = categories.split(",").map((item) => item.trim()).filter(Boolean);
  const update = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const workImage = (index: number) => previews[`workImage${index}`] || artist.works[index]?.image || "/assets/home/hero-artist-studio.webp";
  const status = studioHours ? studioStatus(studioHours, values.visitType) : null;
  const publicAddress = values.locationPrivacy === "exact" && values.address ? values.address : "감천문화마을 일대";

  function pickImage(key: string, file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) return setMessage("이미지는 장당 2MB 이하로 선택해주세요.");
    const reader = new FileReader();
    reader.onload = () => setPreviews((current) => ({ ...current, [key]: String(reader.result || "") }));
    reader.readAsDataURL(file);
    setFiles((current) => ({ ...current, [key]: file }));
    setMessage("");
  }

  async function addPhotos(list: FileList | null) {
    const picked = Array.from(list || []).filter((file) => file.type.startsWith("image/")).slice(0, MAX_GALLERY_PHOTOS - gallery.length);
    if (!picked.length) return;
    setMessage("사진을 준비하고 있습니다…");
    setPreparingPhotos((count) => count + 1);
    try {
      const drafts = await Promise.all(picked.map(async (original) => {
        const file = await compressImage(original);
        if (file.size > MAX_IMAGE_BYTES) throw new Error("too large");
        return { id: crypto.randomUUID(), file, image: URL.createObjectURL(file), caption: "" };
      }));
      setGallery((current) => [...current, ...drafts].slice(0, MAX_GALLERY_PHOTOS));
      setMessage("");
    } catch { setMessage("사진을 줄이지 못했습니다. 2MB 이하 JPG·PNG·WebP로 다시 골라주세요."); }
    finally { setPreparingPhotos((count) => count - 1); }
  }
  const moveGallery = (index: number, step: number) => setGallery((current) => {
    const next = [...current];
    const target = index + step;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  async function publish(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData();
    form.set("applicationId", applicationId);
    form.set("profile", JSON.stringify({ artistName, categories: categoryList, values: { ...values, experience: experiences.length ? "있음" : "없음", experienceDesc: experiences.map(({ title, description }) => `${title}${description ? `: ${description}` : ""}`).join("\n") }, works, experiences, studioHours }));
    for (const [key, file] of Object.entries(files)) form.set(key, file);
    form.set("gallery", JSON.stringify(gallery.map((photo, index) => photo.key ? { key: photo.key, caption: photo.caption } : { upload: `galleryNew${index}`, caption: photo.caption })));
    gallery.forEach((photo, index) => { if (!photo.key && photo.file) form.set(`galleryNew${index}`, photo.file); });
    const response = await fetch("/api/artist/profile", { method: "PUT", body: form });
    const result = await response.json().catch(() => ({})) as { error?: string; gallery?: Array<{ key: string; caption: string }> };
    setSaving(false);
    if (!response.ok) return setMessage(result.error || "저장하지 못했습니다.");
    setFiles({});
    setPreviews({});
    if (result.gallery) setGallery(result.gallery.map((photo) => ({ id: photo.key, key: photo.key, image: photoUrl(photo.key), caption: photo.caption })));
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

        <section className="artist-gallery-section editable-section">
          <div className="artist-detail-heading"><div><span>STUDIO PHOTOS</span><h2>작업실 풍경</h2></div><small>{gallery.length}/{MAX_GALLERY_PHOTOS}장</small></div>
          <button className="inline-edit-button section-edit" type="button" onClick={() => setPanel("gallery")}>사진 관리</button>
          {gallery.length ? <StudioGallery photos={gallery} onOpen={() => setPanel("gallery")}/> : <p className="artist-detail-empty gallery-empty">작업실 내부·외부, 작업하는 모습 사진을 올려보세요.</p>}
        </section>

        <section className="artist-visit-section editable-section">
          <div className="artist-detail-heading"><div><span>STUDIO VISIT</span><h2>화실 방문 정보</h2></div></div><button className="inline-edit-button section-edit" type="button" onClick={() => setPanel("visit")}>방문 정보 수정</button>
          <dl><div><dt><Icon name="visit"/>작업실</dt><dd>{values.studioName || "감천 작업실"}</dd></div><div><dt><Icon name="pin"/>위치</dt><dd>{publicAddress}</dd></div><div><dt><Icon name="clock"/>운영시간</dt><dd>{status && <StatusBadge status={status}/>}{studioHours ? formatWeekly(studioHours) : values.hours || "방문 전 확인"}</dd></div><div><dt><Icon name="visit"/>방문 방식</dt><dd>{values.visitType || "방문 전 문의"}</dd></div></dl>
          {experiences.map((experience) => <div className="artist-experience" key={experience.id}><span>{experience.title || "체험 프로그램"} · {experience.status}</span><p>{experience.description || "체험 내용을 준비하고 있습니다."}</p></div>)}
        </section>

        <section className="artist-channel-section editable-section"><span>작가 채널</span><button className="inline-edit-button section-edit" type="button" onClick={() => setPanel("channels")}>채널 수정</button><div>{values.instagram && <i>Instagram</i>}{values.website && <i>Website</i>}{values.shopUrl && <i>작품 구매</i>}{!values.instagram && !values.website && !values.shopUrl && <small>등록된 채널이 없습니다.</small>}</div></section>
      </ScrollContainer>

      <nav className="visual-editor-actions">{modal ? <button className="visual-editor-exit" {...profileEditorControl("hide")}>나가기</button> : <Link href="/artist">나가기</Link>}<span className={message ? (message.includes("반영") ? "is-ok" : "is-error") : ""} role="status">{message || "수정할 영역을 눌러보세요."}</span><button type="submit" disabled={saving || preparingPhotos > 0}>{saving ? "반영 중…" : "공개 반영"}</button></nav>

      {panel && <section className="visual-edit-sheet" aria-label="공개 프로필 편집 패널"><header><div><span>LIVE PREVIEW</span><h2>{({ profile: "프로필 수정", work: "대표 작품 수정", story: "작가 이야기 수정", visit: "화실 방문 정보", gallery: "작업실 사진", channels: "온라인 채널" } as const)[panel]}</h2></div><button type="button" aria-label="편집 패널 닫기" onClick={() => setPanel(null)}>×</button></header><div className="visual-sheet-body"><fieldset className="visual-sheet-fields" disabled={saving}>
        {panel === "profile" && <><Field label="작가명"><input required maxLength={100} value={artistName} onChange={(event) => setArtistName(event.target.value)}/></Field><Field label="작품 분야"><input required value={categories} placeholder="회화, 일러스트" onChange={(event) => setCategories(event.target.value)}/></Field><Field label="한 줄 소개"><textarea required maxLength={200} rows={3} value={values.tagline} onChange={(event) => update("tagline", event.target.value)}/></Field><ImagePicker label="프로필 이미지" preview={previews.profileImage || artist.profile} onChange={(file) => pickImage("profileImage", file)}/></>}
        {panel === "work" && <><div className="work-selector">{works.map((_, index) => <button className={index === workIndex ? "is-active" : ""} type="button" key={index} onClick={() => setWorkIndex(index)}>{index + 1}</button>)}</div><ImagePicker label="작품 이미지" preview={workImage(workIndex)} onChange={(file) => pickImage(`workImage${workIndex}`, file)}/><Field label="작품명"><input required maxLength={150} value={works[workIndex]?.title || ""} onChange={(event) => setWorks((current) => current.map((item, index) => index === workIndex ? { ...item, title: event.target.value } : item))}/></Field><Field label="작품 상태"><select value={works[workIndex]?.status || "문의 필요"} onChange={(event) => setWorks((current) => current.map((item, index) => index === workIndex ? { ...item, status: event.target.value } : item))}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></Field><Field label="작품 설명"><textarea maxLength={1200} rows={4} value={works[workIndex]?.description || ""} onChange={(event) => setWorks((current) => current.map((item, index) => index === workIndex ? { ...item, description: event.target.value } : item))}/></Field></>}
        {panel === "story" && <Field label="작가 이야기"><textarea maxLength={4000} rows={9} value={values.bio} onChange={(event) => update("bio", event.target.value)}/></Field>}
        {panel === "visit" && <>
          <Field label="작업실 이름"><input maxLength={150} value={values.studioName} onChange={(event) => update("studioName", event.target.value)}/></Field>
          <Field label="주소"><input maxLength={300} value={values.address} onChange={(event) => update("address", event.target.value)}/></Field>
          <Field label="위치 공개 범위"><select value={values.locationPrivacy || "nearby"} onChange={(event) => update("locationPrivacy", event.target.value)}>{LOCATION_PRIVACY_CHOICES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select><small>{LOCATION_PRIVACY_CHOICES.find(({ value }) => value === (values.locationPrivacy || "nearby"))?.description}</small></Field>
          <div className="studio-hours-field"><span>운영시간</span><StudioHoursEditor hours={studioHours} onChange={setStudioHours}/></div>
          {!studioHours && <Field label="운영시간 (글자로 적기)"><textarea maxLength={500} rows={3} value={values.hours} onChange={(event) => update("hours", event.target.value)}/></Field>}
          <Field label="방문 방식"><select value={values.visitType} onChange={(event) => update("visitType", event.target.value)}>{["자유 방문 가능", "운영시간 내 방문 가능", "사전 예약 필요", "일반 방문 불가"].map((item) => <option key={item}>{item}</option>)}</select></Field>
          <div className="visual-experience-heading"><strong>체험 프로그램</strong><button type="button" disabled={experiences.length >= 20} onClick={() => setExperiences((current) => [...current, { id: crypto.randomUUID(), title: "", status: "운영 중", description: "" }])}>＋ 추가</button></div>
          {experiences.map((experience, index) => <div className="visual-experience-card" key={experience.id}><header><strong>체험 {index + 1}</strong><button type="button" onClick={() => setExperiences((current) => current.filter((item) => item.id !== experience.id))}>삭제</button></header><Field label="체험명"><input maxLength={100} value={experience.title} onChange={(event) => setExperiences((current) => current.map((item) => item.id === experience.id ? { ...item, title: event.target.value } : item))}/></Field><Field label="운영 상태"><select value={experience.status} onChange={(event) => setExperiences((current) => current.map((item) => item.id === experience.id ? { ...item, status: event.target.value as ArtistExperience["status"] } : item))}><option>운영 중</option><option>준비 중</option></select></Field><Field label="체험 설명"><textarea maxLength={500} rows={3} value={experience.description} onChange={(event) => setExperiences((current) => current.map((item) => item.id === experience.id ? { ...item, description: event.target.value } : item))}/></Field></div>)}
        </>}
        {panel === "gallery" && <div className="gallery-editor">
          <p>방문객이 작업실 분위기를 알 수 있게 사진을 올려주세요. 첫 번째 사진이 맨 앞에 보입니다. (최대 {MAX_GALLERY_PHOTOS}장)</p>
          {gallery.map((photo, index) => <div className="gallery-editor-row" key={photo.id}>
            <img src={photo.image} alt={`작업실 사진 ${index + 1}`}/>
            <div>
              <input maxLength={MAX_GALLERY_CAPTION} placeholder="사진 설명 (선택)" aria-label={`사진 ${index + 1} 설명`} value={photo.caption} onChange={(event) => setGallery((current) => current.map((item) => item.id === photo.id ? { ...item, caption: event.target.value } : item))}/>
              <span><button type="button" disabled={index === 0} onClick={() => moveGallery(index, -1)} aria-label={`사진 ${index + 1} 앞으로`}>↑</button><button type="button" disabled={index === gallery.length - 1} onClick={() => moveGallery(index, 1)} aria-label={`사진 ${index + 1} 뒤로`}>↓</button><button type="button" onClick={() => setGallery((current) => current.filter((item) => item.id !== photo.id))}>삭제</button>{!photo.key && <em>새 사진</em>}</span>
            </div>
          </div>)}
          {gallery.length < MAX_GALLERY_PHOTOS && <label className="gallery-editor-add">＋ 사진 추가 <small>여러 장 선택 가능 · 큰 사진은 자동으로 줄어듭니다</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void addPhotos(event.target.files); event.target.value = ""; }}/></label>}
        </div>}
        {panel === "channels" && <><Field label="Instagram"><input type="url" value={values.instagram} placeholder="https://instagram.com/..." onChange={(event) => update("instagram", event.target.value)}/></Field><Field label="홈페이지"><input type="url" value={values.website} placeholder="https://..." onChange={(event) => update("website", event.target.value)}/></Field><Field label="온라인 판매처"><input type="url" value={values.shopUrl} placeholder="https://..." onChange={(event) => update("shopUrl", event.target.value)}/></Field></>}
      </fieldset></div><footer><span>입력 내용이 화면에 바로 미리보기 됩니다.</span><button type="button" onClick={() => setPanel(null)}>미리보기 적용</button></footer></section>}
    </div>
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="visual-field"><span>{label}</span>{children}</label>; }
function ImagePicker({ label, preview, onChange }: { label: string; preview: string; onChange: (file?: File) => void }) { return <label className="visual-image-picker"><span>{label}</span><div><img src={preview} alt="이미지 미리보기"/><strong>사진 교체<small>최대 2MB</small></strong></div><input type="file" accept="image/*" onChange={(event) => onChange(event.target.files?.[0])}/></label>; }
