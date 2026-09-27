export const site = {
  brand: "GAMCHEON ARTISTS",
  subBrand: "LOCAL ARTS AGENCY",
  nav: [
    ["프로젝트 소개", "/project"],
    ["작가 소개", "/artists"],
    ["ART MAP", "/map"],
    ["ART PASSPORT", "/passport"],
    ["새로운 소식", "/news"],
    ["협업 문의", "/contact"],
  ],
};

export function loaderBrandLines(brand: string) {
  const words = brand.trim().split(/\s+/);
  return words.length > 1 ? [words.slice(0, -1).join(" "), words.at(-1)!] : words;
}

export function chooseLoaderVariant(randomValue: number) {
  return randomValue < .5 ? "classic" : "studio";
}

export const heroSlides = [
  { eyebrow: "GAMCHEON ARTIST PROJECT", title: "감천의 작가와\n작품을 연결합니다.", text: "작가의 작업과 이야기를 기록하고, 더 많은 사람과 새로운 기회로 이어지는 로컬 아트 에이전시를 시작합니다.", image: "/assets/clone/hero-artist-studio.png", position: "center" },
  { eyebrow: "ARTIST MAP · COMING SOON", title: "골목마다 숨어 있는\n작업실을 발견하세요.", text: "감천에서 활동하는 작가와 공방을 한눈에 만나는 작가 지도를 준비하고 있습니다.", image: "/gamcheon-map-concept.png", position: "center 55%" },
  { eyebrow: "ART COLLABORATION", title: "작품이 일상과\n브랜드를 만납니다.", text: "전시, 체험, 굿즈, 기관 협업까지 작가의 활동 반경을 함께 넓혀갑니다.", image: "/assets/clone/artist-goods.png", position: "center" },
];

export const statLabels = [["참여 작가", "명"], ["기록한 작품", "점"], ["연결한 공간", "곳"], ["준비 중인 프로젝트", "개"]] as const;

export const news = [
  ["작가 모집", "감천에서 활동하는 작가님을 기다립니다", "2026.09.18", "/assets/clone/hero-artist-studio.png"],
  ["프로젝트", "감천 작가 지도 첫 번째 기록을 시작합니다", "2026.09.08", "/gamcheon-map-concept.png"],
  ["협업", "작가와 지역을 잇는 새로운 협업 제안", "2026.08.27", "/assets/clone/artist-goods.png"],
  ["아카이브", "작품과 작업실 이야기를 수집합니다", "2026.08.12", "/og.png"],
] as const;

export const goods = [
  ["ART PRINT", "감천의 빛", "/assets/clone/artist-goods.png", "8% 50%"],
  ["LOCAL MAP", "골목의 기록", "/gamcheon-map-concept.png", "center"],
  ["ART GOODS", "작가의 테이블", "/assets/clone/artist-goods.png", "56% 50%"],
  ["ARCHIVE", "작업실 노트", "/assets/clone/hero-artist-studio.png", "82% 50%"],
  ["ARTIST STORY", "오늘의 작업", "/assets/clone/hero-artist-studio.png", "34% 50%"],
] as const;

export const partners = ["부산광역시", "사하구", "감천문화마을", "LOCAL ART", "ARTIST MAP", "ART PASSPORT", "STUDIO", "COMMUNITY", "ARCHIVE", "COLLABORATION"];
