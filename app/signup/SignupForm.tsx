"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import SocialLoginButtons from "../SocialLoginButtons";
import { pathWithNext } from "../auth-next";
import { SIGNUP_PRIVACY_VERSION } from "./privacy-consent";

export default function SignupForm({ nextPath = "/artist" }: { nextPath?: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ loginId: "", password: "", displayName: "", phone: "", email: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consentRequired, setConsentRequired] = useState(false);
  const [consentEmail, setConsentEmail] = useState(false);
  const update = (name: keyof typeof form, value: string) => setForm((current) => ({ ...current, [name]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.password !== passwordConfirm) { setError("비밀번호가 서로 일치하지 않습니다."); return; }
    if (!consentRequired) { setError("필수 개인정보 수집·이용에 동의해 주세요."); return; }
    if (form.email.trim() && !consentEmail) { setError("이메일 수집·이용에 동의하거나 이메일을 비워 주세요."); return; }
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, consentRequired, consentEmail, privacyVersion: SIGNUP_PRIVACY_VERSION }) });
    const result = await response.json().catch(() => ({})) as { error?: string; redirectTo?: string };
    setLoading(false);
    if (!response.ok) { setError(result.error || "회원가입을 완료하지 못했습니다."); return; }
    router.replace(nextPath);
    router.refresh();
  }

  return <form onSubmit={submit} className="auth-form auth-signup-form" aria-busy={loading}>
    <div className="auth-form-head"><span>ARTIST ACCOUNT</span><h2>작가 회원가입</h2><p>가입 후 작가 페이지에서 프로필과 작품 정보를 관리할 수 있습니다.</p></div>
    <div className="auth-grid"><div className="auth-field"><label htmlFor="signup-name">작가명 / 활동명 <b>*</b></label><input id="signup-name" value={form.displayName} onChange={(e) => update("displayName", e.target.value)} autoComplete="name" placeholder="활동에 사용하는 이름" required autoFocus/></div><div className="auth-field"><label htmlFor="signup-phone">휴대전화 <b>*</b></label><input id="signup-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" placeholder="010-0000-0000" required/></div></div>
    <div className="auth-field"><label htmlFor="signup-email">이메일</label><input id="signup-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" placeholder="artist@example.com"/></div>
    <div className="auth-field"><label htmlFor="signup-id">아이디 <b>*</b></label><input id="signup-id" value={form.loginId} onChange={(e) => update("loginId", e.target.value)} autoComplete="username" placeholder="로그인할 아이디" required/></div>
    <div className="auth-grid"><div className="auth-field"><label htmlFor="signup-password">비밀번호 <b>*</b></label><div className="auth-password"><input id="signup-password" minLength={8} type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => update("password", e.target.value)} autoComplete="new-password" placeholder="비밀번호 입력" required/><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? "숨김" : "보기"}</button></div></div><div className="auth-field"><label htmlFor="signup-password-confirm">비밀번호 확인 <b>*</b></label><input id="signup-password-confirm" type={showPassword ? "text" : "password"} value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" placeholder="한 번 더 입력" required/></div></div>
    <section className="auth-consent" aria-labelledby="signup-consent-heading">
      <h3 id="signup-consent-heading">개인정보 수집·이용 동의</h3>
      <div className="auth-consent-item">
        <label className="auth-consent-check"><input type="checkbox" checked={consentRequired} onChange={(event) => setConsentRequired(event.target.checked)} required/><span>[필수] 개인정보 수집·이용에 동의합니다.</span></label>
        <details className="auth-consent-details"><summary>필수 정보 수집·이용 내용 보기</summary>
          <dl><div><dt>목적</dt><dd>회원 식별, 로그인, 계정 관리 및 작가 신청 관련 연락</dd></div><div><dt>항목</dt><dd>작가명·활동명, 휴대전화, 아이디, 비밀번호의 해시값, 계정번호, 가입·로그인 일시, 동의 내역</dd></div><div><dt>보유기간</dt><dd>회원 탈퇴 또는 동의 철회 요청을 처리할 때까지. 처리 후 지체 없이 삭제하며, 법령에 따라 보존해야 하는 기록은 그 기간 동안만 분리 보관합니다.</dd></div><div><dt>처리 위탁</dt><dd>계정 정보는 Cloudflare(미국)의 서버에 저장됩니다. 자세한 내용은 <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리방침</a>을 확인해 주세요.</dd></div></dl>
          <p>동의를 거부할 수 있으나, 거부하면 회원가입이 제한됩니다.</p>
        </details>
      </div>
      <div className="auth-consent-item">
        <label className="auth-consent-check"><input type="checkbox" checked={consentEmail} onChange={(event) => setConsentEmail(event.target.checked)}/><span>[선택] 이메일 수집·이용에 동의합니다.</span></label>
        <details className="auth-consent-details"><summary>선택 이메일 수집·이용 내용 보기</summary>
          <dl><div><dt>목적</dt><dd>계정 및 작가 신청 관련 이메일 연락</dd></div><div><dt>항목</dt><dd>이메일 주소</dd></div><div><dt>보유기간</dt><dd>회원 탈퇴 또는 동의 철회 처리 시까지</dd></div></dl>
          <p>동의를 거부해도 회원가입할 수 있습니다. 이메일을 비워 두세요.</p>
        </details>
      </div>
      <p className="auth-consent-footer">열람·정정·동의 철회·삭제 요청: <a href="mailto:rjbcom4263@gmail.com">rjbcom4263@gmail.com</a> · <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리방침 보기 ↗</a></p>
    </section>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="auth-submit" type="submit" disabled={loading}>{loading ? "가입 중…" : "회원가입"}</button>
    <p className="auth-social-notice">간편로그인을 선택하면 제공자의 계정 식별 정보와 제공 범위 내 이름·이메일을 계정 연결과 로그인에 이용합니다. <a href="/privacy" target="_blank" rel="noopener noreferrer">자세히 보기 ↗</a></p>
    <SocialLoginButtons nextPath={nextPath}/>
    <div className="auth-switch"><span>이미 작가 계정이 있으신가요?</span><a href={pathWithNext("/login", nextPath)}>로그인</a></div>
  </form>;
}
