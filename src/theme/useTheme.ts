import { useColorScheme } from 'react-native';
import type { ViewStyle } from 'react-native';

import { cardShadow, darkColors, lightColors } from './palette';
import type { ColorTokens, ThemeMode } from './palette';

/**
 * 활성 테마를 내려주는 훅. 시스템 설정(useColorScheme)을 따르고,
 * 값이 없으면 다크(기본)로 폴백한다.
 * 앱 내 수동 테마 전환이 필요해지면 이 훅 내부만 바꾼다 — 호출부는 그대로.
 */
export function useTheme(): { mode: ThemeMode; colors: ColorTokens; cardShadow: ViewStyle } {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === 'light' ? 'light' : 'dark';
  return {
    mode,
    colors: mode === 'light' ? lightColors : darkColors,
    cardShadow: cardShadow[mode],
  };
}
