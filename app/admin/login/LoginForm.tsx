"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    setLoading(false);
    if (!response.ok) { setError("아이디 또는 비밀번호를 다시 확인해주세요."); return; }
    router.replace("/"); router.refresh();
  }
  return <form onSubmit={submit} className="admin-login-card">
    <div className="login-mark">감천</div><p>GAMCHEON ARTIST MAP</p><h1>관리자 로그인</h1><span>작가 신청 내역을 관리하려면 로그인해주세요.</span>
    <label>관리자 아이디<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus/></label>
    <label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required/></label>
    {error && <div className="login-error" role="alert">{error}</div>}
    <button disabled={loading}>{loading ? "확인 중…" : "로그인"}</button><a href="/apply">신청 페이지로 돌아가기</a>
  </form>;
}
