import Svg, { Path } from 'react-native-svg';

import { iconStroke } from '@/theme/tokens';

/** 우표 톱니 테두리 — 16×16 네모의 네 변마다 반지름 1 반원 홈 셋(시계 방향으로 돌며 안쪽으로 판다). */
const STAMP_EDGE = 'M4 4H7a1 1 0 0 0 2 0H11a1 1 0 0 0 2 0H15a1 1 0 0 0 2 0H20V7a1 1 0 0 0 0 2V11a1 1 0 0 0 0 2'
  + 'V15a1 1 0 0 0 0 2V20H17a1 1 0 0 0-2 0H13a1 1 0 0 0-2 0H9a1 1 0 0 0-2 0H4V17a1 1 0 0 0 0-2V13a1 1 0 0 0 0-2'
  + 'V9a1 1 0 0 0 0-2z';

/**
 * 우표 아이콘 — 가장자리가 반원으로 파인 톱니 테두리에 안쪽 네모. lucide 의 Stamp 는 고무도장이라 뜻이 달라 직접 그린다
 * (2026-10-05 아이콘 고르기 페이지, 예전 엽서 탭 아이콘과 같은 그림). 출석 달력·지갑처럼 '우표'를 글자 대신 그리는 자리가 쓴다.
 * lucide 아이콘과 같은 모양의 props(size·color)를 받는다.
 */
export function StampIcon({ size = 24, color }: { size?: number; color: string }) {
  const stroke = { stroke: color, ...iconStroke };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={STAMP_EDGE} {...stroke} />
      <Path d="M8 8h8v8H8z" {...stroke} />
    </Svg>
  );
}
