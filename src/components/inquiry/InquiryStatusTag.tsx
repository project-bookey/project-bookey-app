import type { InquiryStatus } from '@/api/types';
import { Tag } from '@/components/ui';
import { useTheme } from '@/theme';

/**
 * 문의 상태 태그 — 답변 완료는 잉크로 뒤집어 눈에 띄게, 대기는 기본 회색 태그.
 * 강조색(accent)은 쓰지 않는다 — 그 자리는 화면의 '문의하기' 버튼 몫이다(UX 철칙 Von Restorff).
 */
export function InquiryStatusTag({ status }: { status: InquiryStatus }) {
  const { colors } = useTheme();
  return status === 'ANSWERED'
    ? <Tag label="답변 완료" fg={colors.onInk} bg={colors.ink} />
    : <Tag label="답변 대기" />;
}
