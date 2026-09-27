import { redirect } from "next/navigation";
import { requireSession } from "../admin/admin-auth";
import { safeNextPath } from "../auth-next";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const query = await searchParams;
  const nextPath = safeNextPath(query.next, "/");
  const user = await requireSession();
  if (user) redirect(user.role === "admin" ? "/admin" : nextPath);
  const provider = query.error?.split("_")[0];
  const providerName = provider === "kakao" ? "카카오" : provider === "naver" ? "네이버" : "Google";
  const oauthError = query.error?.endsWith("_config")
    ? `${providerName} 로그인 연결을 준비 중입니다. 잠시만 기다려주세요.`
    : query.error ? `${providerName} 로그인을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.` : "";
  return <main className="auth-page">
    <a className="auth-brand" href="/">GAMCHEON ARTISTS<small>LOCAL ARTS AGENCY</small></a>
    <section className="auth-story" aria-label="회원 기능 안내">
      <div><span>MEMBER ACCESS</span><h1>작가 활동을<br/>계속 이어가세요.</h1><p>등록한 프로필과 작품을 관리하고 감천 작가 프로젝트의 새로운 제안을 확인할 수 있습니다.</p></div>
      <ol><li><b>01</b><span>작가 프로필 관리</span></li><li><b>02</b><span>작품 정보 업데이트</span></li><li><b>03</b><span>프로젝트 안내 확인</span></li></ol>
    </section>
    <section className="auth-form-panel"><LoginForm oauthError={oauthError} nextPath={nextPath}/></section>
  </main>;
}
