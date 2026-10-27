// 신청 폼의 상수·타입과 임시 저장(localStorage) 직렬화. 화면 로직은 page.tsx에 있습니다.
import { MAX_EXPERIENCES, REQUIRED_WORK_COUNT } from "../lib/application";

export const STEPS = ["작가 정보", "대표 작품", "활동 공간", "연락·채널", "참여 의견", "확인·제출"];
export const STEP_TITLES = ["프로필 기본 정보", "대표 작품 등록", "활동 공간과 방문", "연락처와 온라인 채널", "프로젝트 참여 의향", "공개 범위와 최종 확인"];
export const STEP_DESCRIPTIONS = [
  "작가 프로필에 가장 먼저 보일 이름과 소개를 입력해주세요.", "작가님의 작업 세계를 잘 보여주는 작품 5점을 등록합니다.",
  "공방 방문 가능 여부와 공개할 위치 범위를 선택해주세요.", "작가님을 다시 찾을 수 있는 채널과 운영진 연락처를 입력합니다.",
  "앞으로 함께 만들 프로젝트에 대한 참여 의향을 알려주세요.", "공개되는 정보와 운영용 정보를 마지막으로 확인합니다.",
];
export const LAST_STEP = STEPS.length - 1;
export const CATEGORIES = ["회화", "민화", "캘리그라피", "도자", "공예", "조각", "섬유", "일러스트", "캐릭터", "사진", "금속", "목공", "기타"];
export const STORAGE_KEY = "gamcheon_artist_apply_v2";

export type Work = { id: string; title: string; status: string; description: string; image?: File; preview?: string };
export type Experience = { id: string; title: string; status: "운영 중" | "준비 중"; description: string };
export type Values = Record<string, string | boolean>;
export type UploadedImage = { type: string; workIndex?: number; key: string; name: string; contentType: string };

export const initialValues: Values = {
  artistName: "", studioName: "", tagline: "", bio: "", address: "", locationPrivacy: "exact",
  visitType: "운영시간 내 방문 가능", hours: "", experience: "없음", experienceDesc: "",
  instagram: "", website: "", shopUrl: "", phone: "", email: "",
  stampInterest: "자세한 설명을 듣고 결정하고 싶음", nfcInterest: "자세한 설명을 듣고 결정하고 싶음",
  feedback: "", consentInfo: false, consentImage: false, consentPrivacy: false,
};

export function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function blankWork(): Work { return { id: uid(), title: "", status: "문의 필요", description: "" }; }
export function blankExperience(): Experience { return { id: uid(), title: "", status: "운영 중", description: "" }; }
export function blankWorks() { return Array.from({ length: REQUIRED_WORK_COUNT }, blankWork); }

export type Draft = { values: Values; categories: string[]; works: Work[]; experiences: Experience[]; step: number };

/** localStorage의 임시 저장본을 읽어 폼 상태로 정리합니다. 없거나 깨졌으면 null. 이미지는 저장하지 않으므로 비웁니다. */
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as { values?: Values; categories?: string[]; works?: Work[]; experiences?: unknown[]; step?: unknown };
    const values = { ...initialValues, ...(draft.values || {}) };
    const restored = (draft.works || []).slice(0, REQUIRED_WORK_COUNT).map((work) => ({ ...work, image: undefined, preview: "" }));
    const works = restored.length ? [...restored, ...Array.from({ length: Math.max(0, REQUIRED_WORK_COUNT - restored.length) }, blankWork)] : blankWorks();
    let experiences: Experience[] = [];
    if (Array.isArray(draft.experiences)) {
      experiences = draft.experiences.slice(0, MAX_EXPERIENCES).map((raw): Experience => {
        const item = raw && typeof raw === "object" ? raw as Partial<Experience> : {};
        return { id: item.id || uid(), title: item.title || "", status: item.status === "준비 중" ? "준비 중" : "운영 중", description: item.description || "" };
      });
    } else if (draft.values?.experience && draft.values.experience !== "없음") {
      // 체험 목록이 생기기 전 저장본: 단일 체험 필드를 목록 한 항목으로 옮깁니다.
      experiences = [{ id: uid(), title: "체험 프로그램", status: draft.values.experience === "준비 중" ? "준비 중" : "운영 중", description: String(draft.values.experienceDesc || "") }];
    }
    return { values, categories: draft.categories || [], works, experiences, step: Math.min(Number(draft.step) || 0, LAST_STEP) };
  } catch {
    return null;
  }
}

/** 이미지 파일을 뺀 폼 상태를 localStorage에 저장합니다. 저장이 막혀 있으면 false. */
export function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      values: draft.values, categories: draft.categories, step: draft.step, experiences: draft.experiences,
      works: draft.works.map((w) => ({ id: w.id, title: w.title, status: w.status, description: w.description })),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
}
