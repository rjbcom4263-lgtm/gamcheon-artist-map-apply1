import { redirect } from "next/navigation";

// 지도 관리 홈은 없앴습니다. 예전 주소로 들어오면 골목지도 작업실로 보냅니다(왼쪽 메뉴에서 각 도구로 바로 갑니다).
export default function AdminMapManagementPage() {
  redirect("/admin/art-map");
}
