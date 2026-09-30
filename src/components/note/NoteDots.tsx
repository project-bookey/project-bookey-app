import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';
import type { CanvasSize } from './noteDoc';

/** 도트 간격·반지름(논리 단위) — 격자·대형노트가 같은 값이라 대형노트는 점이 네 배 많다. */
export const DOT_GAP = 40;
export const DOT_R = 2.5;
/** 화면에서 점이 사라지지 않게 하는 최소 반지름(px). */
export const DOT_MIN_PX = 0.6;

/**
 * 노트 도트 종이 — 점 간격이 화면 px 이 아니라 논리 단위라 줌·내보내기 크기와 함께 커진다
 * (콜라주 배경의 DotGridBackground 는 화면 px 고정이라 쓰지 않는다).
 * 네이티브는 viewBox 를 논리 캔버스로 잡은 SVG Pattern 한 장. 웹은 NoteDots.web.tsx(CSS 배경).
 */
export function NoteDots({ canvas, width, height }: { canvas: CanvasSize; width: number; height: number }) {
  const { colors } = useTheme();
  const id = `notedots${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const scale = width / canvas.w;
  const r = Math.max(DOT_R, DOT_MIN_PX / Math.max(scale, 1e-6));
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={width}
      height={height}
      viewBox={`0 0 ${canvas.w} ${canvas.h}`}
      pointerEvents="none"
    >
      <Defs>
        <Pattern id={id} width={DOT_GAP} height={DOT_GAP} patternUnits="userSpaceOnUse">
          <Circle cx={DOT_GAP / 2} cy={DOT_GAP / 2} r={r} fill={colors.dotGrid} />
        </Pattern>
      </Defs>
      <Rect width={canvas.w} height={canvas.h} fill={`url(#${id})`} />
    </Svg>
  );
}
