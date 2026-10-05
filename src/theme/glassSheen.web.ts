import type { ViewStyle } from 'react-native';

/**
 * 유리 버튼 위쪽 광택 — 웹(react-native-web)은 RN 의 experimental_backgroundImage 를 모르므로 CSS backgroundImage 로
 * 넘긴다. RN 타입에 없는 키라 ViewStyle 로 맞춰 둔다.
 */
export const glassSheen = {
  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 60%)',
} as unknown as ViewStyle;
