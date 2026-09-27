import { pathWithNext } from "./auth-next";

export default function SocialLoginButtons({ nextPath = "/" }: { nextPath?: string }) {
  return <div className="auth-social-list" aria-label="간편 로그인">
    <a className="auth-social auth-google" href={pathWithNext("/api/auth/google/start", nextPath)}><span aria-hidden="true">G</span>구글로 시작하기</a>
    <a className="auth-social auth-kakao" href={pathWithNext("/api/auth/kakao/start", nextPath)}><span aria-hidden="true">K</span>카카오톡으로 시작하기</a>
    <a className="auth-social auth-naver" href={pathWithNext("/api/auth/naver/start", nextPath)}><span aria-hidden="true">N</span>네이버로 시작하기</a>
  </div>;
}
