// 로그아웃 링크 대신 쓰는 POST 폼입니다. 서버 컴포넌트에서도 그대로 쓸 수 있고 JS 없이 동작합니다.
// 버튼은 .logout-button 클래스로 주변 링크와 같은 모양이 되도록 globals.css에서 초기화합니다.
export function LogoutButton({ admin = false, className = "" }: { admin?: boolean; className?: string }) {
  return (
    <form method="post" action={admin ? "/api/admin/logout" : "/api/auth/logout"} className="logout-form">
      <button type="submit" className={className ? `logout-button ${className}` : "logout-button"}>로그아웃</button>
    </form>
  );
}
