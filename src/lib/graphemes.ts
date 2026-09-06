/**
 * 보이는 글자(grapheme) 세기 — 엽서 16글자 제한(§14.9 확정: 한글 완성형 글자 기준).
 * 서버(GraphemeCounter, \X 정규식)가 최종 판정하므로 여기 값은 입력 UI 용이다.
 * Intl.Segmenter 가 없는 런타임(구형 Hermes)에서는 코드포인트 수로 근사한다 —
 * ZWJ 조합 이모지가 실제보다 크게 세지지만, 초과로 세는 쪽이라 서버 거절보다 먼저 막아준다.
 */
const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('ko', { granularity: 'grapheme' })
    : null;

export function countGraphemes(text: string): number {
  if (!text) return 0;
  if (segmenter) {
    let count = 0;
    for (const _ of segmenter.segment(text)) count += 1;
    return count;
  }
  return Array.from(text).length;
}
