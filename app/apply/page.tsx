"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { MAX_EXPERIENCES, REQUIRED_WORK_COUNT } from "../lib/application";
import { compressImage } from "../lib/image-client";
import { openDaumPostcode } from "./daum-postcode";
import { APPLICATION_RETENTION_TEXT, APPLY_CONSENT_VERSION } from "../signup/privacy-consent";
import {
  CATEGORIES, LAST_STEP, STEPS, STEP_DESCRIPTIONS, STEP_TITLES, blankExperience, blankWorks, clearDraft, initialValues, loadDraft, saveDraft,
  type Experience, type UploadedImage, type Values, type Work,
} from "./apply-form";

// 상수·타입·임시 저장은 apply-form.ts, 이미지 축소는 lib/image-client.ts, 주소 검색은 daum-postcode.ts에 있습니다.
const SHOW_REGISTRATION_INTRO = false;

export default function Home() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(initialValues);
  const [categories, setCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState("");
  const [works, setWorks] = useState<Work[]>(blankWorks);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [profileImage, setProfileImage] = useState<File>();
  const [profilePreview, setProfilePreview] = useState("");
  const [saveLabel, setSaveLabel] = useState("자동 저장 준비");
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const [error, setError] = useState("");
  const [imageProcessing, setImageProcessing] = useState(0);
  const [addressLoading, setAddressLoading] = useState(false);

  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    setValues(draft.values);
    setCategories(draft.categories);
    setWorks(draft.works);
    setExperiences(draft.experiences);
    setStep(draft.step);
    setSaveLabel("이전 임시 저장 불러옴");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/applications/current", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((result: { application?: { status?: string } } | null) => {
      if (!cancelled && result?.application && result.application.status !== "draft") window.location.replace("/artist");
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (submittedId) return;
    const timer = window.setTimeout(() => {
      if (saveDraft({ values, categories, works, experiences, step })) setSaveLabel(`임시 저장됨 · ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
      else setSaveLabel("일부 정보 저장 제한");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [values, categories, works, experiences, step, submittedId]);

  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const currentTitle = STEP_TITLES[step];
  const currentDesc = STEP_DESCRIPTIONS[step];

  const update = (name: string, value: string | boolean) => setValues((v) => ({ ...v, [name]: value }));
  const loadAddressSearch = () => openDaumPostcode((address) => update("address", address), setAddressLoading);
  const addCustomCategory = () => {
    const category = customCategory.trim().slice(0, 30);
    if (!category) return;
    setCategories((list) => list.includes(category) ? list : [...list, category]);
    setCustomCategory("");
  };
  const input = (name: string, type = "text", placeholder = "", required = false) => (
    <input type={type} name={name} value={String(values[name] || "")} placeholder={placeholder} required={required} onChange={(e) => update(name, e.target.value)} />
  );
  const textArea = (name: string, placeholder = "") => <textarea name={name} value={String(values[name] || "")} placeholder={placeholder} onChange={(e) => update(name, e.target.value)} />;
  const select = (name: string, options: string[]) => <select name={name} value={String(values[name])} onChange={(e) => update(name, e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select>;

  async function pickImage(e: ChangeEvent<HTMLInputElement>, kind: "profile" | "work", workId?: string) {
    const original = e.target.files?.[0];
    if (!original) return;
    if (!original.type.startsWith("image/")) { alert("이미지 파일만 선택해주세요."); return; }
    if (original.size > 30 * 1024 * 1024) { alert("원본 이미지는 한 장당 30MB 이하로 선택해주세요."); return; }
    let file: File;
    setImageProcessing((count) => count + 1);
    try { file = await compressImage(original); }
    catch { alert("이 사진 형식을 읽지 못했습니다. JPG 또는 PNG로 다시 선택해주세요."); return; }
    finally { setImageProcessing((count) => Math.max(0, count - 1)); }
    if (!file) return;
    if (file.size > 1500 * 1024) { alert("사진 용량을 줄이지 못했습니다. 다른 사진을 선택해주세요."); return; }
    const preview = URL.createObjectURL(file);
    if (kind === "profile") { setProfileImage(file); setProfilePreview(preview); }
    else setWorks((list) => list.map((w) => w.id === workId ? { ...w, image: file, preview } : w));
  }

  function validate() {
    if (imageProcessing > 0) return "사진을 처리하고 있습니다. 잠시만 기다려주세요.";
    if (step === 0 && (!String(values.artistName).trim() || !String(values.tagline).trim() || !categories.length)) return "작가명, 작품 분야, 한 줄 소개를 입력해주세요.";
    if (step === 1 && works.length < REQUIRED_WORK_COUNT) return "대표 작품 5점을 모두 입력해주세요.";
    if (step === 1 && works.some((work) => !work.title.trim())) return "대표 작품 5점의 작품명을 모두 입력해주세요.";
    if (step === 1 && works.some((work) => !work.image)) return "대표 작품 5점의 이미지를 모두 선택해주세요.";
    if (step === 2 && experiences.some((experience) => !experience.title.trim())) return "추가한 체험 프로그램의 이름을 입력해주세요.";
    if (step === 3 && !String(values.phone).trim()) return "운영진 연락용 휴대전화를 입력해주세요.";
    if (step === LAST_STEP && (!values.consentInfo || !values.consentImage || !values.consentPrivacy)) return "필수 동의 항목을 모두 확인해주세요.";
    return "";
  }

  function next() {
    const message = validate();
    if (message) { alert(message); return; }
    setStep((s) => Math.min(LAST_STEP, s + 1));
    document.querySelector(".workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function uploadApplicationImage(applicationId: string, image: File, type: "profile" | "work", workIndex?: number) {
    const data = new FormData();
    data.set("applicationId", applicationId);
    data.set("type", type);
    if (typeof workIndex === "number") data.set("workIndex", String(workIndex));
    data.set("image", image);
    const response = await fetch("/api/applications/images", { method: "POST", body: data });
    const result = await response.json().catch(() => ({})) as { image?: UploadedImage; error?: string };
    if (!response.ok || !result.image) throw new Error(result.error || "이미지를 저장하지 못했습니다.");
    return result.image;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step < LAST_STEP) { next(); return; }
    const message = validate(); if (message) { alert(message); return; }
    setSubmitting(true); setError("");
    try {
      setSaveLabel("신청 번호 발급 중...");
      const initResponse = await fetch("/api/applications/init", { method: "POST" });
      const init = await initResponse.json().catch(() => ({})) as { id?: string; error?: string };
      if (!initResponse.ok || !init.id) throw new Error(init.error || "신청 번호를 만들지 못했습니다.");

      const uploadedImages: UploadedImage[] = [];
      const allImages = [
        ...(profileImage ? [{ type: "profile" as const, image: profileImage }] : []),
        ...works.map((work, index) => ({ type: "work" as const, image: work.image, workIndex: index })),
      ];
      for (let i = 0; i < allImages.length; i += 1) {
        const item = allImages[i];
        if (!item.image) continue;
        setSaveLabel(`사진 저장 중 ${i + 1} / ${allImages.length}`);
        uploadedImages.push(await uploadApplicationImage(init.id, item.image, item.type, item.workIndex));
      }

      setSaveLabel("신청서 저장 중...");
      const data = new FormData();
      data.set("payload", JSON.stringify({ applicationId: init.id, values: { ...values, consentVersion: APPLY_CONSENT_VERSION, experience: experiences.length ? "있음" : "없음", experienceDesc: experiences.map(({ title, description }) => `${title}${description ? `: ${description}` : ""}`).join("\n") }, categories, works: works.map(({ id, title, status, description }) => ({ id, title, status, description })), experiences, expectedImages: { profile: Boolean(profileImage), works: works.map((work) => Boolean(work.image)) }, uploadedImages }));
      const response = await fetch("/api/applications", { method: "POST", body: data });
      const contentType = response.headers.get("content-type") || "";
      const result = contentType.includes("application/json") ? await response.json() : { error: await response.text() };
      if (!response.ok) throw new Error(result.error || "접수 중 오류가 발생했습니다.");
      clearDraft(); setSubmittedId(result.id);
    } catch (err) { setError(err instanceof Error ? err.message : "접수 중 오류가 발생했습니다."); }
    finally { setSubmitting(false); }
  }

  const summary = useMemo(() => ({ artist: String(values.artistName || "-"), categories: categories.join(", ") || "-", works: works.length }), [values.artistName, categories, works.length]);

  return <div className="app apply-make-theme">
    <header className="topbar"><div className="topbar-inner"><a className="apply-brand" href="/">GAMCHEON ARTISTS<small>LOCAL ARTS AGENCY</small></a><div className="apply-header-actions"><a href="/">프로젝트 홈</a><div className="save-state"><i />{saveLabel}</div></div></div></header>
    <main>
      {SHOW_REGISTRATION_INTRO && <section className="hero">
        <div className="hero-card"><div className="eyebrow">ARTIST REGISTRATION</div><h1>작가님의 작업과<br />이야기를 등록해주세요.</h1><p>등록한 정보는 운영진 확인 후 작가 프로필과 감천 작가 지도에 연결됩니다. 앞으로 전시, 굿즈, 협업을 제안할 때 활용할 기본 프로필이 됩니다.</p><div className="hero-note"><span className="pill">약 10분</span><span className="pill">대표작 5점 준비</span><span className="pill">자동 임시 저장</span></div></div>
        <aside className="side-card"><div><span className="side-kicker">AFTER REGISTRATION</span><div className="side-title">등록 후 이렇게 연결됩니다.</div><div className="flow">{["작가별 소개 페이지 생성", "작품 아카이브와 지도 연결", "공방 방문·온라인 채널 안내", "전시·굿즈·협업 제안 연결"].map((x, i) => <div className="flow-row" key={x}><div className="flow-dot">0{i + 1}</div><span>{x}</span></div>)}</div></div><div className="side-callout">입력한 연락처는 운영진 확인용이며, 동의 없이 외부에 공개하지 않습니다.</div></aside>
      </section>}
      <div className="workspace">
        <nav className="steps" aria-label="등록 단계"><div className="steps-title"><span>REGISTRATION</span><strong>작가 정보 등록</strong></div>{STEPS.map((label, i) => <button type="button" key={label} disabled={i > step && !submittedId} onClick={() => i <= step && setStep(i)} aria-current={i === step ? "step" : undefined} className={`step-item ${i === step ? "active" : ""} ${i < step || submittedId ? "done" : ""}`}><div className="step-num">{i < step || submittedId ? "✓" : i + 1}</div><span>{label}</span></button>)}</nav>
        <section className="form-card">
          {submittedId ? <div className="success show"><div className="success-icon">✓</div><h2>작가 정보 등록이 완료되었습니다.</h2><p>운영진이 내용을 확인한 뒤 입력하신 연락처로 안내드리겠습니다.</p><div className="receipt">접수번호 <strong>{submittedId}</strong></div><div className="summary"><div><span>작가명</span><strong>{summary.artist}</strong></div><div><span>분야</span><strong>{summary.categories}</strong></div><div><span>대표작</span><strong>{summary.works}점</strong></div></div></div> : <>
            <div className="progress-wrap"><div className="progress-head"><span>STEP {String(step + 1).padStart(2, "0")} · {STEPS[step]}</span><span>{progress}% 완료</span></div><div className="progress"><span style={{ width: `${progress}%` }} /></div></div>
            <form onSubmit={submit} noValidate><div className="form-head"><div><h2>{currentTitle}</h2><p>{currentDesc}</p></div></div>
              {step === 0 && <div className="section active"><div className="grid-2"><div className="field"><label>작가명 / 활동명 <b>*</b></label>{input("artistName", "text", "예: 홍길동 / 길동작가", true)}</div><div className="field"><label>공방·작업실 이름</label>{input("studioName", "text", "없으면 비워두셔도 됩니다")}</div></div><div className="field"><label>작품 분야 <b>*</b></label><div className="chips">{CATEGORIES.map((c) => <button type="button" key={c} className={`chip ${categories.includes(c) ? "selected" : ""}`} onClick={() => setCategories((list) => list.includes(c) ? list.filter((x) => x !== c) : [...list, c])}>{c}</button>)}{categories.filter((c) => !CATEGORIES.includes(c)).map((c) => <button type="button" key={c} className="chip selected custom-chip" onClick={() => setCategories((list) => list.filter((x) => x !== c))}>{c} ×</button>)}</div><div className="custom-category"><input value={customCategory} maxLength={30} placeholder="목록에 없다면 직접 입력" onChange={(e) => setCustomCategory(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomCategory(); } }}/><button type="button" onClick={addCustomCategory}>분야 추가</button></div><small>복수 선택이 가능하며, 없는 분야는 직접 입력할 수 있습니다.</small></div><div className="field"><label>작가 한 줄 소개 <b>*</b></label>{input("tagline", "text", "예: 감천의 풍경과 사람을 민화로 기록합니다.", true)}<small>관광객이 카드에서 가장 먼저 읽는 문장입니다.</small></div><div className="field"><label>작가 소개</label>{textArea("bio", "작업 세계, 재료, 감천과의 관계 등을 자유롭게 소개해주세요.")}</div><div className="field"><label>프로필 / 대표 이미지</label><label className="upload"><input type="file" accept="image/*" onChange={(e) => pickImage(e, "profile")} /><span className="plus">＋</span><strong>{imageProcessing ? "사진 처리 중…" : "이미지 선택"}</strong><small>고화질 사진도 자동으로 용량을 줄여 저장합니다.</small></label>{profilePreview && <><img src={profilePreview} className="preview" alt="프로필 미리보기" /><small className="image-ready">✓ 저장할 사진 준비 완료 · {profileImage?.name}</small></>}</div></div>}
              {step === 1 && <div className="section active"><div className="info-panel"><strong>대표작 5점 모두 이미지 필수</strong><p>작가님의 작품을 충분히 보여줄 수 있도록 대표 작품 5점의 이름, 설명, 사진을 등록해주세요.</p></div>{works.map((work, i) => <div className="work-card" key={work.id}><div className="work-card-head"><strong>대표 작품 {i + 1} · 필수</strong></div><div className="grid-2"><div className="field"><label>작품명 <b>*</b></label><input value={work.title} placeholder="작품명" onChange={(e) => setWorks((l) => l.map((w) => w.id === work.id ? { ...w, title: e.target.value } : w))} /></div><div className="field"><label>작품 상태</label><select value={work.status} onChange={(e) => setWorks((l) => l.map((w) => w.id === work.id ? { ...w, status: e.target.value } : w))}>{["판매 가능", "전시 작품", "문의 필요", "판매하지 않음"].map((o) => <option key={o}>{o}</option>)}</select></div></div><div className="field"><label>작품 설명</label><textarea value={work.description} placeholder="관광객이 작품을 이해할 수 있는 짧은 설명" onChange={(e) => setWorks((l) => l.map((w) => w.id === work.id ? { ...w, description: e.target.value } : w))} /></div><div className="field"><label>작품 이미지 <b>*</b></label><label className="upload compact"><input type="file" accept="image/*" onChange={(e) => pickImage(e, "work", work.id)} /><span className="plus">＋</span><strong>{imageProcessing ? "사진 처리 중…" : "작품 이미지 선택"}</strong></label>{work.preview && <><img src={work.preview} className="preview" alt={`${work.title || "작품"} 미리보기`} /><small className="image-ready">✓ 저장할 사진 준비 완료 · {work.image?.name}</small></>}</div></div>)}</div>}
              {step === 2 && <div className="section active">
                <div className="field"><label>공방 주소</label><div className="address-search-row">{input("address", "text", "예: 부산 사하구 감내2로 ...")}<button type="button" className="address-search-button" onClick={loadAddressSearch} disabled={addressLoading}>{addressLoading ? "불러오는 중…" : "주소 검색"}</button></div><small>주소 검색으로 찾은 주소를 입력할 수 있습니다. 공개 범위에 따라 실제 지도에는 다르게 표시됩니다.</small></div>
                <div className="field"><label>위치 공개 범위</label><div className="choice-list">{[["exact", "정확한 공방 위치 공개", "지도 마커와 주소를 공개합니다."], ["nearby", "근처 위치만 공개", "정확한 작업실 주소는 숨깁니다."], ["reservation", "예약 방문객에게만 안내", "세부 주소는 별도로 안내합니다."]].map(([v, t, d]) => <label className="choice" key={v}><input type="radio" checked={values.locationPrivacy === v} onChange={() => update("locationPrivacy", v)} /><span><strong>{t}</strong><small>{d}</small></span></label>)}</div></div>
                <div className="field"><label>방문 방식</label>{select("visitType", ["자유 방문 가능", "운영시간 내 방문 가능", "사전 예약 필요", "일반 방문 불가"])}</div>
                <div className="field"><label>운영시간</label>{textArea("hours", "예: 화~일 11:00~18:00 / 월요일 휴무")}</div>
                <div className="field"><div className="experience-heading"><label>체험 프로그램</label><button type="button" onClick={() => setExperiences((list) => list.length < MAX_EXPERIENCES ? [...list, blankExperience()] : list)} disabled={experiences.length >= MAX_EXPERIENCES}>＋ 체험 추가</button></div>
                  {experiences.length === 0 && <p className="experience-empty">등록할 체험이 없다면 비워두셔도 됩니다.</p>}
                  {experiences.map((experience, index) => <div className="experience-card" key={experience.id}>
                    <div className="experience-card-head"><strong>체험 {index + 1}</strong><button type="button" onClick={() => setExperiences((list) => list.filter((item) => item.id !== experience.id))} aria-label={`체험 ${index + 1} 삭제`}>삭제</button></div>
                    <div className="field"><label htmlFor={`experience-title-${experience.id}`}>체험명 <b>*</b></label><input id={`experience-title-${experience.id}`} value={experience.title} maxLength={100} placeholder="예: 감천 풍경 그리기" onChange={(event) => setExperiences((list) => list.map((item) => item.id === experience.id ? { ...item, title: event.target.value } : item))}/></div>
                    <div className="field"><label htmlFor={`experience-status-${experience.id}`}>운영 상태</label><select id={`experience-status-${experience.id}`} value={experience.status} onChange={(event) => setExperiences((list) => list.map((item) => item.id === experience.id ? { ...item, status: event.target.value as Experience["status"] } : item))}><option>운영 중</option><option>준비 중</option></select></div>
                    <div className="field"><label htmlFor={`experience-description-${experience.id}`}>체험 설명</label><textarea id={`experience-description-${experience.id}`} value={experience.description} maxLength={500} placeholder="내용, 소요시간, 예약 여부 등을 적어주세요." onChange={(event) => setExperiences((list) => list.map((item) => item.id === experience.id ? { ...item, description: event.target.value } : item))}/></div>
                  </div>)}
                </div>
              </div>}
              {step === 3 && <div className="section active"><div className="grid-2"><div className="field"><label>Instagram</label>{input("instagram", "url", "https://instagram.com/...")}</div><div className="field"><label>홈페이지</label>{input("website", "url", "https://...")}</div></div><div className="field"><label>온라인 판매처</label>{input("shopUrl", "url", "스마트스토어 등")}</div><div className="info-panel"><strong>운영진 연락용</strong><p>아래 정보는 확인·연락을 위해서만 사용하며 관광객에게 공개하지 않습니다.</p></div><div className="grid-2"><div className="field"><label>휴대전화 <b>*</b></label>{input("phone", "tel", "010-0000-0000", true)}</div><div className="field"><label>이메일</label>{input("email", "email", "artist@example.com")}</div></div></div>}
              {step === 4 && <div className="section active"><div className="apply-passport-feature"><img src="/assets/home/art-passport-visual-labeled.webp" alt="표지에 ART PASSPORT가 적힌 감천 아트 패스포트 이미지"/><div><span>GAMCHEON ART PASSPORT</span><strong>작가의 공간을 방문하고<br/>작품의 이야기를 수집하세요.</strong><p>작가 지도와 아트 패스포트는 골목의 작업실을 찾고, 작가와 작품을 더 가까이 만나는 지역 문화 경험입니다.</p><a href="/passport" target="_blank" rel="noopener noreferrer">홈페이지에서 자세히 보기 ↗</a></div></div><div className="field"><label>작가 스탬프 프로젝트</label>{select("stampInterest", ["참여하고 싶음", "자세한 설명을 듣고 결정하고 싶음", "현재는 참여 의사 없음"])}</div><div className="field"><label>NFC 작가 카드</label>{select("nfcInterest", ["참여하고 싶음", "자세한 설명을 듣고 결정하고 싶음", "현재는 참여 의사 없음"])}</div><div className="field"><label>감천 작가 지도에 바라는 기능이나 의견</label>{textArea("feedback", "관광객에게 꼭 보여주고 싶은 정보, 우려되는 점, 필요한 기능 등을 적어주세요.")}</div></div>}
              {step === LAST_STEP && <div className="section active">
                <div className="info-panel"><strong>서비스 공개 정보</strong><p>작가명, 소개, 작품, 선택한 범위의 위치·방문 정보, 등록한 온라인 채널</p></div>
                <div className="info-panel warm"><strong>운영 목적으로만 사용</strong><p>휴대전화, 이메일, 신청 관련 연락 정보</p></div>
                <p className="consent-intro">각 항목의 내용을 펼쳐 확인해 주세요. <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리방침 전문 보기 ↗</a></p>
                <div className="consent-item"><label className="consent-box"><input type="checkbox" checked={Boolean(values.consentInfo)} onChange={(event) => update("consentInfo", event.target.checked)}/><span>작가 및 작품 정보를 감천 작가 지도와 작품 해설에 게시·이용하는 것에 동의합니다. <b>*</b></span></label><details className="consent-details"><summary>게시 정보와 이용 범위 보기</summary><div><p>운영자 승인 후 작가명·분야·소개·작품 정보, 선택한 범위의 위치·방문 정보, 등록한 온라인 채널이 작가 소개 페이지, 감천 작가 지도(웹·지도 앱), 작품 해설 페이지에 공개될 수 있습니다.</p><p>작품 해설은 QR 코드와 NFC 태그로 연결되는 웹 주소로 배포되며, 운영자가 검수한 영어 등 다른 언어 번역본을 함께 공개할 수 있습니다. 작가 소개와 작품 해설 내용은 감천 작가 프로젝트의 안내물·아트 패스포트에도 실릴 수 있습니다.</p><p>정확한 주소는 ‘정확한 공방 위치 공개’를 선택한 경우에만 공개될 수 있습니다. 공개 철회는 운영팀에 요청할 수 있고, 철회 후에는 새로 제작하는 안내물에 싣지 않습니다.</p></div></details></div>
                <div className="consent-item"><label className="consent-box"><input type="checkbox" checked={Boolean(values.consentImage)} onChange={(event) => update("consentImage", event.target.checked)}/><span>등록한 작품 이미지를 서비스에서 게시·가공하는 것에 동의합니다. <b>*</b></span></label><details className="consent-details"><summary>이미지 이용 범위 보기</summary><div><p>신청서에 등록한 프로필 이미지와 대표 작품 이미지는 승인 후 작가 소개, 감천 작가 지도, 작품 해설 페이지와 QR·NFC로 연결되는 해설 화면에 사용될 수 있습니다.</p><p>화면 크기에 맞게 이미지를 축소·잘라내기·형식 변환(WebP 등)해 표시할 수 있습니다. 작품 자체를 수정하거나 다른 창작물의 재료로 쓰지 않으며, 저작권은 작가에게 있습니다. 이미지를 서비스 밖에서 상업적으로 이용하려면 별도로 동의를 받습니다.</p><p>공개 철회·삭제는 운영팀에 요청할 수 있습니다. 외부에서 이미 저장하거나 복사한 이미지는 즉시 회수하기 어려울 수 있습니다.</p></div></details></div>
                <div className="consent-item"><label className="consent-box"><input type="checkbox" checked={Boolean(values.consentPrivacy)} onChange={(event) => update("consentPrivacy", event.target.checked)}/><span>개인정보 수집·이용에 동의합니다. <b>*</b></span></label><details className="consent-details"><summary>수집 항목·목적·보유기간 보기</summary><div><dl><dt>이용 목적</dt><dd>작가 신청 접수·검토·연락, 승인 후 작가 소개</dd><dt>처리 항목</dt><dd>작가명, 분야, 한 줄 소개, 작품 정보·이미지, 휴대전화, 동의 선택, 접수번호·일시·상태. 소개, 프로필 사진, 공방·위치·방문 정보, 온라인 채널, 이메일과 의견은 입력한 경우에 처리합니다.</dd><dt>보유기간</dt><dd>{APPLICATION_RETENTION_TEXT}</dd><dt>처리 위탁</dt><dd>자료는 Cloudflare(미국)의 서버에 저장됩니다. 자세한 내용은 개인정보 처리방침을 확인해 주세요.</dd></dl><p>필수 항목의 동의를 거부하면 작가 신청을 진행하기 어렵습니다. 정보 열람·정정·삭제와 동의 철회는 <a href="mailto:rjbcom4263@gmail.com">운영팀에 요청</a>할 수 있습니다.</p></div></details></div>
                {error && <div className="error" role="alert">{error}</div>}
              </div>}
              <div className="actions"><button type="button" className="ghost" style={{ visibility: step === 0 ? "hidden" : "visible" }} onClick={() => setStep((s) => Math.max(0, s - 1))}>이전</button><button className="primary" type="submit" disabled={submitting || imageProcessing > 0}>{imageProcessing > 0 ? "사진 처리 중…" : submitting ? "접수 중…" : step === LAST_STEP ? "신청서 제출" : "다음"}</button></div>
            </form>
          </>}
        </section>
      </div>
    </main>
    <footer className="site-footer"><span>GAMCHEON ARTISTS · 작가와 지역의 다음 기회를 연결합니다.</span><div><a href="/">프로젝트 홈</a><a href="/login">작가 로그인</a><a href="/privacy">개인정보 처리방침</a><a href="/third-party-notices.txt">오픈소스·지도 데이터 출처</a></div></footer>
  </div>;
}
