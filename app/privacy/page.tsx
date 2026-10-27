import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "../admin/admin-auth";
import { Header } from "../home/SectionPage";
import { site } from "../home/content";
import "./privacy.css";

export const metadata: Metadata = {
  title: "개인정보 처리방침 초안 | 감천 작가 프로젝트",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const contact = "rjbcom4263@gmail.com";
const sections = [
  ["operator", "운영자와 문의"],
  ["collection", "수집 항목·보유기간"],
  ["publication", "공개 범위와 위치"],
  ["providers", "외부 서비스·국외 처리"],
  ["deletion", "파기와 보존"],
  ["rights", "권리 행사와 동의"],
  ["storage", "쿠키·기기 저장"],
  ["security", "안전조치·방침 변경"],
] as const;

export default async function PrivacyPage() {
  const user = await requireSession();
  return <div className="agency-page privacy-shell">
    <Header user={user ? { role: user.role } : null}/>
    <main className="privacy-page" id="privacy-top">
      <nav className="privacy-breadcrumb" aria-label="현재 위치"><Link href="/">홈</Link><span aria-hidden="true">/</span><span aria-current="page">개인정보 처리방침</span></nav>
      <header className="privacy-hero">
        <div><p className="privacy-eyebrow">PRIVACY POLICY</p><h1>개인정보 처리방침</h1><p className="privacy-intro">작가님의 정보를 어떻게 수집하고 이용하며 공개하는지 안내합니다.</p><div className="privacy-meta"><span>최종 수정 2026.10.18</span><span className="privacy-status">운영 검토 초안</span></div></div>
        <div className="privacy-overview"><strong>먼저 확인해 주세요</strong><ul><li>신청서에서 선택한 위치 공개 범위에 따라 주소 표시가 달라집니다.</li><li>운영 연락용 휴대전화와 이메일은 작가 소개에 표시하지 않습니다.</li><li>공개 철회·정보 삭제 요청은 운영팀 이메일로 접수합니다.</li></ul></div>
      </header>
      <div className="privacy-layout">
        <aside className="privacy-toc"><strong>안내 목차</strong><nav aria-label="개인정보 처리방침 목차">{sections.map(([id, title], index) => <a href={`#privacy-${id}`} key={id}><span>{String(index + 1).padStart(2, "0")}</span>{title}</a>)}</nav><a className="privacy-contact-link" href={`mailto:${contact}`}>개인정보 문의 ↗</a></aside>
        <article className="privacy-content" aria-label="개인정보 처리방침 상세">
          <aside className="privacy-draft"><strong>운영 검토 초안</strong><p>이 페이지는 현재 서비스의 개인정보 처리 현황을 설명하기 위해 복구한 초안입니다. 작가 신청 자료의 보유기간, 위탁·국외 처리 조건, 삭제 절차 등 운영자가 확정해야 할 사항을 검토하고 있습니다. 문의나 정보 삭제 요청은 아래 연락처로 보내주세요.</p></aside>
          <section id="privacy-operator"><h2>1. 운영자와 개인정보 문의</h2><p>서비스 운영자는 새김(감천 작가 프로젝트)입니다. 개인정보 열람·정정·삭제, 공개 철회와 기타 문의는 <a href={`mailto:${contact}`}>{contact}</a>으로 접수합니다. 요청 내용과 본인 여부를 확인한 뒤 처리 방법과 결과를 안내합니다.</p></section>
          <section id="privacy-collection"><h2>2. 처리 목적·항목·보유기간</h2><div className="privacy-table-wrap"><table><caption className="privacy-sr-only">서비스별 처리 목적, 수집 항목, 보유기간</caption><thead><tr><th scope="col">구분</th><th scope="col">목적과 항목</th><th scope="col">보유기간</th></tr></thead><tbody>
            <tr><th scope="row">작가 계정</th><td data-label="목적과 항목">회원 식별·로그인·계정 관리와 작가 신청 관련 연락. 아이디, 비밀번호의 해시값, 작가명·활동명, 휴대전화, 계정번호, 가입·최근 로그인 일시와 동의 내역을 처리합니다. 이메일은 선택 항목입니다.</td><td data-label="보유기간">회원 탈퇴 또는 동의 철회 처리 시까지 보관합니다. 법령상 별도 보존이 필요한 경우에는 해당 근거와 기간을 확인해 처리합니다.</td></tr>
            <tr><th scope="row">간편 로그인</th><td data-label="목적과 항목">선택한 로그인 제공자의 계정 식별 정보와 제공 범위 내 이름·별명·이메일을 계정 연결과 로그인에 이용할 수 있습니다.</td><td data-label="보유기간">계정 이용 기간 및 연결 해제·삭제 요청 처리 시까지. 제공자별 저장 항목과 기간은 확인 후 보완합니다.</td></tr>
            <tr><th scope="row">작가 신청</th><td data-label="목적과 항목">신청 접수·검토·연락과 승인 후 작가 소개. 작가명, 분야, 한 줄 소개, 작품 정보·이미지, 휴대전화, 동의 선택, 접수번호·일시·상태를 처리합니다. 소개, 프로필 사진, 공방·위치·방문 정보, 온라인 채널, 이메일과 의견은 입력한 경우에만 처리합니다.</td><td data-label="보유기간">신청 검토 및 프로젝트 참여 기간 동안 보관하며, 공개 철회·삭제 요청 시 관련 자료와 보존 필요 여부를 확인하여 처리합니다. 구체적인 기간은 운영 기준 확정 후 반영합니다.</td></tr>
          </tbody></table></div><p>일반 회원가입에서는 필수 개인정보 수집·이용 동의와 선택 이메일 동의 여부, 동의한 안내 버전과 일시를 계정과 함께 기록합니다. 신청서에서는 게시·이미지·개인정보 안내 확인 항목을 받습니다. 법령에 따른 별도 보존이 필요한 경우에는 근거와 항목, 기간을 확인해 이 방침에 반영합니다.</p></section>
          <section id="privacy-publication"><h2>3. 공개 범위와 위치</h2><p>운영자 승인 후 작가명·분야·소개·작품·이미지·방문 정보·등록한 온라인 채널이 공개될 수 있습니다. 현재 신청서의 위치 공개 범위는 ‘정확한 공방 위치’, ‘근처 위치’, ‘예약 방문객에게만 안내’ 중에서 선택합니다. 정확한 주소는 ‘정확한 공방 위치’를 선택한 경우 공개될 수 있으므로 제출 전에 확인해 주세요.</p><p>운영 연락용 휴대전화·이메일·내부 신청 의견은 작가 소개에 표시하지 않습니다. 공개한 온라인 채널에 개인 연락처가 담겨 있을 수 있으므로 등록 전 확인해 주세요. 공개 철회는 운영팀에 요청할 수 있지만 외부에서 이미 저장·복사한 정보는 즉시 회수하기 어렵습니다.</p></section>
          <section id="privacy-providers"><h2>4. 외부 서비스·국외 처리</h2><p>홈페이지 운영과 데이터·이미지 보관에 Cloudflare Workers·D1·R2를 이용합니다. 주소 검색에는 외부 주소 검색 서비스, 지도에는 지도·위치 관련 서비스, 간편 로그인에는 이용자가 선택한 로그인 제공자가 연결될 수 있습니다. 이 과정에서 서비스 제공에 필요한 요청 정보가 각 사업자에게 전달될 수 있습니다.</p><p>Cloudflare와 기타 사업자의 실제 처리·접근 국가, 재위탁 범위, 계약 조건과 보유기간은 운영 설정을 확인 중입니다. 확인이 끝나면 수탁자·이전 국가·항목·목적·기간 및 관련 권리 행사 방법을 이 방침에 구체적으로 반영하겠습니다.</p></section>
          <section id="privacy-deletion"><h2>5. 파기와 보존</h2><p>현재 서비스에는 이용자가 직접 계정과 신청 자료를 한 번에 삭제하는 기능이 없습니다. 삭제·공개 철회를 원하면 운영팀에 요청해 주세요. 운영자가 계정, 신청서, 게시 상태와 저장 이미지를 확인해 처리하고 결과를 안내합니다. 계정 상태 변경만으로 모든 신청서·이미지가 함께 파기되는 것은 아닙니다.</p><p>운영 데이터의 삭제가 백업이나 외부에 복사된 정보의 즉시 삭제를 뜻하지는 않습니다. 백업 보유·만료 조건과 실제 파기 절차를 확인해 정식 운영 기준에 반영할 예정입니다.</p></section>
          <section id="privacy-rights"><h2>6. 권리 행사와 동의 거부</h2><p>이용자는 개인정보의 열람·정정·삭제·처리정지, 수집·이용 동의 철회와 공개 철회 등을 요청할 수 있습니다. 법정대리인이나 위임받은 대리인의 요청은 권한을 확인합니다. 법령상 제한이 있으면 근거와 이유를 안내합니다. 가입·신청에 필요한 항목을 제공하지 않으면 해당 절차를 진행하기 어려울 수 있으며, 이메일 등 선택 항목은 입력하지 않아도 됩니다.</p></section>
          <section id="privacy-storage"><h2>7. 쿠키·기기 저장·현재 위치</h2><p>로그인 상태 유지를 위한 세션 쿠키는 최대 8시간 유지됩니다. 브라우저에서 쿠키를 차단·삭제하면 로그인이 필요한 기능을 이용하기 어려울 수 있습니다. 신청서 작성 내용은 제출 전 브라우저 저장 공간에 임시 보관되고, 제출이 완료되면 해당 임시 저장을 삭제합니다. 저장한 작가 목록도 브라우저 저장 공간을 이용합니다.</p><p>지도의 내 위치 기능을 이용할 때는 브라우저의 위치 권한을 요청할 수 있습니다. 기기 위치 권한은 브라우저나 운영체제 설정에서 거부·철회할 수 있습니다.</p></section>
          <section id="privacy-security"><h2>8. 안전조치와 방침 변경</h2><p>계정 비밀번호는 해시값으로 저장하고, 로그인 세션과 관리자 접근을 구분해 처리합니다. 접근 통제, 기록 관리, 저장 자료의 보호와 파기 절차의 실제 운영 범위는 추가 확인 중입니다. 정식 방침을 확정하거나 내용을 변경하면 홈페이지에 수정일과 함께 게시하겠습니다.</p></section>
          <div className="privacy-document-end"><span>안내 버전 2026-10-18-draft</span><a href="#privacy-top">맨 위로 ↑</a></div>
        </article>
      </div>
    </main>
    <footer className="agency-footer"><Link className="agency-brand" href="/"><b>{site.brand}</b><small>{site.subBrand}</small></Link><div><p>새김 | 감천 작가 프로젝트</p><p><a href={`mailto:${contact}`}>{contact}</a></p><p>부산광역시 감천문화마을</p></div><div><Link href="/project">프로젝트 소개</Link><Link href="/artists">작가 소개</Link><Link href="/map">작가 지도</Link><Link href="/privacy" aria-current="page">개인정보 처리방침</Link><a href="/third-party-notices.txt">오픈소스·지도 데이터 출처</a></div><small>© 2026 GAMCHEON ARTISTS. ALL RIGHTS RESERVED.</small></footer>
  </div>;
}
