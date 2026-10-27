import Home from "./home/page";

export const dynamic = "force-dynamic";

// 운영 홈. 실제 화면은 app/home/ (예전 폴더 이름 landing-sample)에 있습니다.
export default function HomePage() {
  return <Home />;
}
