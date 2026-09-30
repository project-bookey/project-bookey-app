import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { CanvasSize } from './noteDoc';

export const DOT_GAP = 40;
export const DOT_R = 2.5;
export const DOT_MIN_PX = 0.6;

/**
 * 노트 도트 종이(웹) — react-native-svg 의 Pattern 은 웹 번들에서 깨지므로 CSS radial-gradient 로 그린다.
 * 간격·반지름은 논리 단위를 화면 배율로 바꿔 쓴다(줌하면 점도 같이 커진다).
 */
export function NoteDots({ canvas, width }: { canvas: CanvasSize; width: number; height: number }) {
  const { colors } = useTheme();
  const scale = width / canvas.w;
  const gap = DOT_GAP * scale;
  const r = Math.max(DOT_R * scale, DOT_MIN_PX);
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundImage: `radial-gradient(circle, ${colors.dotGrid} ${r}px, transparent ${r}px)`,
          backgroundSize: `${gap}px ${gap}px`,
        } as unknown as ViewStyle,
      ]}
    />
  );
}
