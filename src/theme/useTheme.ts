import { useColorScheme } from 'react-native';
import type { ViewStyle } from 'react-native';

import { useThemePreference } from '@/store/themePreference';
import { cardShadow, darkColors, lightColors } from './palette';
import type { ColorTokens, ThemeMode } from './palette';

/**
 * 활성 테마를 내려주는 훅. 앱 내 선호(themePreference)가 우선이고,
 * '시스템'이면 기기 설정(useColorScheme)을 따르되 값이 없으면 다크(기본)로 폴백한다.
 * 시그니처는 불변 — 테마 정책이 바뀌면 이 훅 내부만 바꾼다 (수동 테마 전환 스펙).
 */
export function useTheme(): { mode: ThemeMode; colors: ColorTokens; cardShadow: ViewStyle } {
  const preference = useThemePreference((s) => s.preference);
  const scheme = useColorScheme();
  const mode: ThemeMode =
    preference === 'system' ? (scheme === 'light' ? 'light' : 'dark') : preference;
  return {
    mode,
    colors: mode === 'light' ? lightColors : darkColors,
    cardShadow: cardShadow[mode],
  };
}
