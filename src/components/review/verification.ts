import type { VerificationLevel } from '@/api/types';

/**
 * 리뷰 검증 등급 라벨 — 서버가 읽기 기록으로 판정한 값을 사람 말로 옮긴다.
 * 도서 상세 조각·리뷰 카드·완독 미리보기가 같은 말을 써야 해서 여기 한 곳에 둔다.
 */
export const VERIFICATION_LABEL: Record<VerificationLevel, string> = {
  VERIFIED_FULL: '완독 검증',
  VERIFIED_PARTIAL: '부분 검증',
  UNVERIFIED: '미검증',
  FLAGGED: '검토 중',
};
