// 카카오(다음) 우편번호 검색 창. 스크립트는 처음 누를 때 한 번만 불러옵니다.

export type AddressResult = { roadAddress?: string; jibunAddress?: string; address?: string };

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: { oncomplete: (data: AddressResult) => void }) => { open: () => void };
    };
  }
}

const SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

function open(onComplete: (address: string) => void) {
  if (!window.daum?.Postcode) return;
  new window.daum.Postcode({ oncomplete: (data) => onComplete(data.roadAddress || data.jibunAddress || data.address || "") }).open();
}

/** 검색 창을 엽니다. 스크립트가 아직 없으면 불러온 뒤 엽니다. onLoading은 불러오는 동안 true, 끝나면 false. */
export function openDaumPostcode(onComplete: (address: string) => void, onLoading: (loading: boolean) => void) {
  if (window.daum?.Postcode) { open(onComplete); return; }
  onLoading(true);
  const existing = document.querySelector<HTMLScriptElement>("script[data-daum-postcode]");
  const script = existing || document.createElement("script");
  if (!existing) {
    script.src = SCRIPT_URL;
    script.async = true;
    script.dataset.daumPostcode = "true";
    document.head.appendChild(script);
  }
  script.addEventListener("load", () => { onLoading(false); open(onComplete); }, { once: true });
  script.addEventListener("error", () => { onLoading(false); alert("주소 검색을 불러오지 못했습니다."); }, { once: true });
}
