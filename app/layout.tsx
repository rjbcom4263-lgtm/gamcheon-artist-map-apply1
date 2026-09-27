import type { Metadata } from "next";
import "./globals.css";
import "./agency.css";
import "./apply/apply.css";
import "./auth.css";
import "./artist/artist.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gamcheon-artist-apply.rjbcom4263.chatgpt.site"),
  title: "감천 작가 프로젝트 | 작가와 작품을 연결합니다",
  description: "감천의 작가와 작품을 소개하고, 작가 참여와 지역 프로젝트를 연결하는 감천 작가 프로젝트입니다.",
  openGraph: { title: "감천 작가 프로젝트", description: "감천의 작가와 작품을 발견하고 새로운 기회를 연결합니다.", type: "website", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "감천 작가 프로젝트", description: "감천의 작가와 작품을 발견하고 새로운 기회를 연결합니다.", images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
