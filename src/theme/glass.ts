import type { ViewStyle } from 'react-native';

import { glassSheen } from './glassSheen';
import type { ColorTokens } from './palette';
import { glassAlpha, hairline } from './tokens';

/** '#rgb'·'#rrggbb' → rgba(). 이미 rgba()·이름 색이면 그대로 돌려준다. */
export function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#')) return color;
  let hex = color.slice(1);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * 유리 버튼 면 — 2026-10-05 사용자 결정(버튼 비교 페이지 15-F). 색을 glassAlpha(55%)로 비치게 깔고,
 * 가장자리 빛·윗선 하이라이트·위쪽 광택·옅은 그림자로 살짝 떠 보이게 한다.
 * 블러는 넣지 않는다 — 목록마다 버튼이 많아 저사양 Android 스크롤이 무거워지고, 종이 위에서는 비칠 것도 없다.
 * 블러는 콘텐츠 위에 떠 있는 것(탭 바·클럽 머리 아이콘)에만 GlassView/BlurView 로 쓴다.
 */
export function glassFace(colors: ColorTokens, base: string): ViewStyle {
  return {
    backgroundColor: withAlpha(base, glassAlpha),
    borderWidth: hairline,
    borderColor: colors.glassEdge,
    boxShadow: `inset 0 1px 0 ${colors.glassHighlight}, inset 0 -1px 0 rgba(0,0,0,0.1), 0 2px 10px rgba(0,0,0,0.14)`,
    ...glassSheen,
  };
}
