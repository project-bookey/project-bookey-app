import { StyleSheet } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { DotGridBackground } from '@/components/collage';
import { useTheme } from '@/theme';
import { CANVAS, type NotePaper as Paper } from './noteDoc';

/** 줄노트 간격·왼쪽 여백선 위치(논리 단위). */
const LINE_GAP = 60;
const FIRST_LINE = 80;
const MARGIN_X = 80;

/**
 * 페이지 종이 — 민무늬 / 도트 격자(기존 DotGridBackground, 웹 변형 있음) / 줄노트.
 * 줄노트는 Path 하나로 그린다 — react-native-svg 의 Pattern·Defs 는 웹 번들을 깨므로 쓰지 않는다.
 */
export function NotePaper({ paper, width, height }: { paper: Paper; width: number; height: number }) {
  const { colors } = useTheme();
  if (paper === 'plain') return null;
  if (paper === 'grid') return <DotGridBackground />;

  let d = '';
  for (let y = FIRST_LINE; y < CANVAS.h; y += LINE_GAP) d += `M0 ${y}H${CANVAS.w}`;
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={width}
      height={height}
      viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`}
      pointerEvents="none"
    >
      <Path d={d} stroke={colors.line} strokeWidth={1.5} fill="none" />
      <Line x1={MARGIN_X} y1={0} x2={MARGIN_X} y2={CANVAS.h} stroke={colors.dangerSoft} strokeWidth={2} />
    </Svg>
  );
}
