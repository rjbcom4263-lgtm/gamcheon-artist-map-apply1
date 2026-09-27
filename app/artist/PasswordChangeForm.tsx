"use client";

import { FormEvent, useState } from "react";

export default function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== newPasswordConfirm) { setMessage("새 비밀번호가 서로 일치하지 않습니다."); return; }
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/artist/password", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) { setMessage(result.error || "비밀번호를 변경하지 못했습니다."); return; }
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setMessage("비밀번호가 변경되었습니다.");
  }

  return <form className="artist-password-form" onSubmit={submit}>
    <div className="artist-password-copy"><p>ACCOUNT SECURITY</p><h2>비밀번호 변경</h2><span>현재 비밀번호를 확인한 뒤 새 비밀번호로 변경할 수 있습니다.</span></div>
    <div className="artist-password-fields"><label>현재 비밀번호<input type={showPassword ? "text" : "password"} value={currentPassword} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} required/></label><label>새 비밀번호<input type={showPassword ? "text" : "password"} value={newPassword} autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} required/></label><label>새 비밀번호 확인<input type={showPassword ? "text" : "password"} value={newPasswordConfirm} autoComplete="new-password" onChange={(event) => setNewPasswordConfirm(event.target.value)} required/></label></div>
    <label className="artist-password-toggle"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)}/> 비밀번호 표시</label>
    {message && <strong className="artist-password-message" role="status">{message}</strong>}
    <button className="artist-password-submit" disabled={saving}>{saving ? "변경 중…" : "비밀번호 변경"}<span>→</span></button>
  </form>;
}
