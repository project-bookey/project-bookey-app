import { useId } from 'react';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';
import { dotGridFor } from './dotGrid';
import type { CanvasSize, CanvasWindow } from './noteDoc';

/**
 * 노트 도트 종이 — 점 간격이 화면 px 이 아니라 논리 단위라 줌·내보내기 크기와 함께 커진다
 * (콜라주 배경의 DotGridBackground 는 화면 px 고정이라 쓰지 않는다). 줄여 보면 점을 성기게 찍는다(dotGridFor).
 * 네이티브는 창(window) 크기의 SVG 한 장 — viewBox 를 창의 논리 구역으로 잡고, Pattern 은 userSpaceOnUse 라
 * 창이 옮겨져도 점 자리가 캔버스 원점에 맞는다. 웹은 NoteDots.web.tsx(CSS 배경).
 */
export function NoteDots({ canvas, width, window }: { canvas: CanvasSize; width: number; window: CanvasWindow }) {
  const { colors } = useTheme();
  const id = `notedots${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const scale = width / canvas.w;
  const { gap, rPx } = dotGridFor(scale);
  const vx = window.x / scale;
  const vy = window.y / scale;
  const vw = window.w / scale;
  const vh = window.h / scale;
  return (
    <Svg
      style={{ position: 'absolute', left: window.x, top: window.y }}
      width={window.w}
      height={window.h}
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      pointerEvents="none"
    >
      <Defs>
        <Pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse">
          <Circle cx={gap / 2} cy={gap / 2} r={rPx / scale} fill={colors.dotGrid} />
        </Pattern>
      </Defs>
      <Rect x={vx} y={vy} width={vw} height={vh} fill={`url(#${id})`} />
    </Svg>
  );
}
