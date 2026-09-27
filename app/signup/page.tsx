import { redirect } from "next/navigation";
import { requireSession } from "../admin/admin-auth";
import { safeNextPath } from "../auth-next";
import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  const nextPath = safeNextPath(query.next, "/artist");
  const user = await requireSession();
  if (user?.role === "admin") redirect("/admin");
  if (user?.role === "artist") redirect(nextPath);
  return <main className="auth-page auth-signup-page">
    <a className="auth-brand" href="/">GAMCHEON ARTISTS<small>LOCAL ARTS AGENCY</small></a>
    <section className="auth-story" aria-label="회원가입 안내">
      <div><span>ARTIST MEMBERSHIP</span><h1>작가의 이야기가<br/>더 멀리 닿도록.</h1><p>당신의 작품과 이야기가 더 많은 사람에게 발견되는 공간, 감천 작가 프로젝트와 지금 시작하세요.</p></div>
      <ol><li><b>01</b><span>작품 등록 및 관리</span></li><li><b>02</b><span>더 많은 기회</span></li><li><b>03</b><span>작가 커뮤니티</span></li></ol>
    </section>
    <section className="auth-form-panel"><SignupForm nextPath={nextPath}/></section>
  </main>;
}
