"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import SocialLoginButtons from "../SocialLoginButtons";
import { pathWithNext } from "../auth-next";

export default function LoginForm({ oauthError = "", nextPath = "/" }: { oauthError?: string; nextPath?: string }) {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(oauthError);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ loginId, password }) });
    const result = await response.json().catch(() => ({})) as { error?: string; redirectTo?: string };
    setLoading(false);
    if (!response.ok) { setError(result.error || "로그인 정보를 다시 확인해주세요."); return; }
    router.replace(nextPath);
    router.refresh();
  }

  return <form onSubmit={submit} className="auth-form auth-login-form" aria-busy={loading}>
    <div className="auth-form-head"><span>WELCOME BACK</span><h2>로그인</h2><p>작가 계정 또는 운영자 계정으로 로그인해주세요.</p></div>
    <div className="auth-field"><label htmlFor="login-id">아이디</label><input id="login-id" value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" placeholder="아이디를 입력해주세요" required autoFocus/></div>
    <div className="auth-field"><label htmlFor="login-password">비밀번호</label><div className="auth-password"><input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="비밀번호를 입력해주세요" required/><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? "숨김" : "보기"}</button></div></div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="auth-submit" type="submit" disabled={loading}>{loading ? "확인 중…" : "로그인"}<span>→</span></button>
    <div className="auth-divider"><span>또는 간편 로그인</span></div>
    <SocialLoginButtons nextPath={nextPath}/>
    <div className="auth-switch"><span>아직 작가 계정이 없으신가요?</span><a href={pathWithNext("/signup", nextPath)}>회원가입</a></div>
    <a className="auth-sub-link" href="/signup?next=%2Fapply">작가 참여를 신청하고 싶어요 <span>↗</span></a>
  </form>;
}
