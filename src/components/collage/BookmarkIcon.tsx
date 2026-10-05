import Svg, { Path } from 'react-native-svg';

import { iconStroke } from '@/theme/tokens';

/**
 * 책갈피 아이콘 — 앱 화폐 '책갈피'. 헤더 책갈피 칩과 지갑이 같은 그림을 쓴다(아래가 V 로 파인 네모 띠).
 * lucide 아이콘과 같은 모양의 props(size·color)를 받는다.
 */
export function BookmarkIcon({ size = 24, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h12v18l-6-4.5L6 21z" stroke={color} {...iconStroke} />
    </Svg>
  );
}
