import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { dotGridFor } from './dotGrid';
import type { CanvasSize, CanvasWindow } from './noteDoc';

/**
 * 노트 도트 종이(웹) — react-native-svg 의 Pattern 은 웹 번들에서 깨지므로 CSS radial-gradient 로 그린다.
 * 간격·반지름은 논리 단위를 화면 배율로 바꿔 쓴다(줌하면 점도 같이 커지고, 줄이면 성기게 찍는다).
 * 창(window) 크기의 상자에만 칠하고, 배경 위치를 창 원점만큼 되돌려 점 자리를 캔버스 원점에 맞춘다.
 */
export function NoteDots({ canvas, width, window }: { canvas: CanvasSize; width: number; window: CanvasWindow }) {
  const { colors } = useTheme();
  const scale = width / canvas.w;
  const { gap: logicalGap, rPx } = dotGridFor(scale);
  const gap = logicalGap * scale;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: window.x,
        top: window.y,
        width: window.w,
        height: window.h,
        backgroundImage: `radial-gradient(circle, ${colors.dotGrid} ${rPx}px, transparent ${rPx}px)`,
        backgroundSize: `${gap}px ${gap}px`,
        backgroundPosition: `${-(window.x % gap)}px ${-(window.y % gap)}px`,
      } as unknown as ViewStyle}
    />
  );
}
