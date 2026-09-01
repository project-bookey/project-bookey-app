import type { ViewStyle } from 'react-native';

import { cardShadow, darkColors } from './palette';
import type { ColorTokens, ThemeMode } from './palette';

/**
 * 활성 테마를 내려주는 훅. 당분간 다크 고정(2026-09-01 후속 결정) —
 * 리디자인 검수 중 화면 간 톤 불일치를 막기 위해 시스템 설정을 따르지 않는다.
 * 라이트 팔레트는 유지하며, 앱 내 테마 토글이 생기면 이 훅 내부만 바꾼다 — 호출부는 그대로.
 */
export function useTheme(): { mode: ThemeMode; colors: ColorTokens; cardShadow: ViewStyle } {
  const mode: ThemeMode = 'dark';
  return {
    mode,
    colors: darkColors,
    cardShadow: cardShadow[mode],
  };
}
