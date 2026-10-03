import type { InquiryCategory } from '@/api/types';

/**
 * 문의 쓰기 초안 — 실수로 뒤로 가도 쓰던 글이 남게 모듈 메모리에 둔다.
 * 앱을 끄면 사라지는 가벼운 보관이고, 보내면 비운다. 사진은 담지 않는다(올린 사진은 24시간 뒤 서버가 정리한다).
 * 쓴 사람(userId)을 함께 적어 두어, 같은 기기에서 다른 계정으로 바꿔 들어오면 남의 초안을 보이지 않는다.
 */
export type InquiryDraft = { category: InquiryCategory | null; body: string };

const EMPTY: InquiryDraft = { category: null, body: '' };
let saved: { userId: number | null; draft: InquiryDraft } = { userId: null, draft: EMPTY };

export function readInquiryDraft(userId: number | null | undefined): InquiryDraft {
  return saved.userId != null && saved.userId === userId ? saved.draft : EMPTY;
}

export function saveInquiryDraft(userId: number | null | undefined, draft: InquiryDraft) {
  saved = { userId: userId ?? null, draft };
}

export function clearInquiryDraft() {
  saved = { userId: null, draft: EMPTY };
}
