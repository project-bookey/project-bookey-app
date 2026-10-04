import { createContext, createElement, useContext } from 'react';
import { useColorScheme } from 'react-native';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

import { useThemePreference } from '@/store/themePreference';
import { cardShadow, darkColors, lightColors } from './palette';
import type { ColorTokens, ThemeMode } from './palette';

/** 감싼 부분만 모드를 고정한다 — 앱 둘러보기 말풍선처럼 테마와 무관하게 늘 어두운 조각에 쓴다. */
const ForcedMode = createContext<ThemeMode | null>(null);

/** 자식 전체(Button 같은 공용 부품 포함)가 이 모드의 색을 받게 한다. */
export function ForceThemeMode({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  return createElement(ForcedMode.Provider, { value: mode }, children);
}

/**
 * 활성 테마를 내려주는 훅. 앱 내 선호(themePreference)가 우선이고,
 * '시스템'이면 기기 설정(useColorScheme)을 따르되 값이 없으면 다크(기본)로 폴백한다.
 * ForceThemeMode 안에서는 그 모드가 이긴다.
 * 시그니처는 불변 — 테마 정책이 바뀌면 이 훅 내부만 바꾼다 (수동 테마 전환 스펙).
 */
export function useTheme(): { mode: ThemeMode; colors: ColorTokens; cardShadow: ViewStyle } {
  const forced = useContext(ForcedMode);
  const preference = useThemePreference((s) => s.preference);
  const scheme = useColorScheme();
  const mode: ThemeMode =
    forced ?? (preference === 'system' ? (scheme === 'light' ? 'light' : 'dark') : preference);
  return {
    mode,
    colors: mode === 'light' ? lightColors : darkColors,
    cardShadow: cardShadow[mode],
  };
}
