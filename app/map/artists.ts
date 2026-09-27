// Concept records only. Replace with consented artist profiles and surveyed positions before launch.
export const artists = [
  { id: "01", name: "윤슬", field: "회화", studio: "푸른 지붕 작업실", color: "#246b94", x: 35, y: 42, wx: 47, wy: 54, work: "골목에 머무는 빛", intro: "매일 다른 빛으로 물드는 집과 골목을 그림에 담습니다.", material: "캔버스에 아크릴", story: "아침이면 창문을 열고 맞은편 지붕을 바라봅니다. 익숙한 풍경에서도 매일 새로운 색을 찾는 작가를 상상했습니다." },
  { id: "02", name: "소담", field: "도예", studio: "흙을 빚는 방", color: "#ac583a", x: 56, y: 32, wx: 65, wy: 44, work: "작은 집, 작은 그릇", intro: "손끝의 흔적이 남은 그릇에 마을의 온기를 담습니다.", material: "흙 · 유약", story: "집들이 모여 마을이 되듯, 서로 다른 그릇이 모여 한 상을 만듭니다. 생활과 작업이 이어지는 공방의 예시입니다." },
  { id: "03", name: "이음", field: "섬유", studio: "실과 골목", color: "#47744a", x: 72, y: 48, wx: 79, wy: 61, work: "이어지는 풍경", intro: "오래된 천과 실을 이어 골목의 기억을 수놓습니다.", material: "직물 · 손자수", story: "천 조각 하나에도 누군가의 시간이 남아 있습니다. 작은 조각들을 이어 새로운 풍경을 만드는 작업을 소개합니다." },
  { id: "04", name: "모루", field: "설치", studio: "골목 실험실", color: "#7763a5", x: 43, y: 65, wx: 31, wy: 73, work: "바람의 자리", intro: "바람과 그림자로 골목에 작은 변화를 만듭니다.", material: "금속 · 혼합 재료", story: "걷다가 잠시 멈추는 자리, 바람이 스쳐 가는 소리에 귀 기울이는 설치 작업을 위한 가상 공간입니다." },
  { id: "05", name: "여울", field: "사진", studio: "느린 사진관", color: "#356e75", x: 22, y: 56, wx: 15, wy: 43, work: "오후의 감천", intro: "지나치기 쉬운 일상의 장면을 천천히 기록합니다.", material: "디지털 사진", story: "화려한 풍경 사이의 작은 일상을 발견하는 사진가를 상상했습니다. 사진 속 이야기와 촬영 장소를 연결하는 예시입니다." },
  { id: "06", name: "온유", field: "회화", studio: "언덕 위 화실", color: "#aa7130", x: 66, y: 72, wx: 55, wy: 81, work: "겹겹의 집", intro: "층층이 쌓인 집들의 리듬을 선과 색으로 그립니다.", material: "종이에 수채", story: "언덕을 따라 이어지는 집들은 저마다 다른 표정을 가지고 있습니다. 그 형태와 색을 관찰하는 화실의 예시입니다." },
];

export function filterArtists(query: string, field: string) {
  const text = query.trim().toLocaleLowerCase("ko");
  return artists.filter(a => (field === "전체" || a.field === field) && `${a.name} ${a.studio} ${a.work} ${a.field}`.toLocaleLowerCase("ko").includes(text));
}
