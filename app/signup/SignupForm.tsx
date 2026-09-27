"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import SocialLoginButtons from "../SocialLoginButtons";
import { pathWithNext } from "../auth-next";

export default function SignupForm({ nextPath = "/artist" }: { nextPath?: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ loginId: "", password: "", displayName: "", phone: "", email: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const update = (name: keyof typeof form, value: string) => setForm((current) => ({ ...current, [name]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.password !== passwordConfirm) { setError("비밀번호가 서로 일치하지 않습니다."); return; }
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
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
    <div className="auth-grid"><div className="auth-field"><label htmlFor="signup-password">비밀번호 <b>*</b></label><div className="auth-password"><input id="signup-password" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => update("password", e.target.value)} autoComplete="new-password" placeholder="비밀번호 입력" required/><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? "숨김" : "보기"}</button></div></div><div className="auth-field"><label htmlFor="signup-password-confirm">비밀번호 확인 <b>*</b></label><input id="signup-password-confirm" type={showPassword ? "text" : "password"} value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" placeholder="한 번 더 입력" required/></div></div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="auth-submit" type="submit" disabled={loading}>{loading ? "가입 중…" : "회원가입"}</button>
    <SocialLoginButtons nextPath={nextPath}/>
    <div className="auth-switch"><span>이미 작가 계정이 있으신가요?</span><a href={pathWithNext("/login", nextPath)}>로그인</a></div>
  </form>;
}
