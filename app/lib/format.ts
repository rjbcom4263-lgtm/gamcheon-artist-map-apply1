/** 신청서 상태 라벨. 관리자 화면은 draft(작성 중)를 다루지 않으므로 APPLICATION_STATUS_LABELS를, 작가 화면은 ARTIST_STATUS_LABELS를 씁니다. */
export const APPLICATION_STATUS_LABELS = { received: "접수", reviewing: "검토 중", approved: "승인", hold: "보류", rejected: "반려", cancelled: "신청자 취소" } as const;
export const ARTIST_STATUS_LABELS = { draft: "작성 중", ...APPLICATION_STATUS_LABELS } as const;
export const ACCOUNT_STATUS_LABELS = { pending: "승인 대기", active: "활성", suspended: "정지", deleted: "삭제됨" } as const;

export function statusLabel(labels: Record<string, string>, status: string) {
  return labels[status] || status;
}

/** D1의 CURRENT_TIMESTAMP(UTC, Z 없음)를 한국어 날짜·시간으로 표시합니다. */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value + (value.endsWith("Z") ? "" : "Z")));
}
