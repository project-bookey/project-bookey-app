import type { ViewStyle } from 'react-native';

/** 유리 버튼 위쪽 광택 — 네이티브는 새 아키텍처의 experimental_backgroundImage 로 그린다(웹은 glassSheen.web.ts). */
export const glassSheen: ViewStyle = {
  experimental_backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 60%)',
};
