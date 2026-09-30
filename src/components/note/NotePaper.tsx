import Svg, { Line, Path } from 'react-native-svg';

import { useTheme } from '@/theme';
import { NoteDots } from './NoteDots';
import { CANVAS, type CanvasSize, type CanvasWindow, type NotePaper as Paper } from './noteDoc';

/** 줄노트 간격·왼쪽 여백선 위치(논리 단위). */
const LINE_GAP = 60;
const FIRST_LINE = 80;
const MARGIN_X = 80;

/**
 * 페이지 종이 — 민무늬 / 도트 격자(논리 단위 간격, NoteDots) / 줄노트.
 * 줄노트는 Path 하나로 그린다 — react-native-svg 의 Pattern·Defs 는 웹 번들을 깨므로 쓰지 않는다.
 * canvas 는 문서의 논리 크기(대형노트 5000×5000) — 생략하면 격자 크기. window 는 그릴 구역(px) — 생략하면 전체.
 */
export function NotePaper({ paper, width, height, canvas = CANVAS, window }: {
  paper: Paper;
  width: number;
  height: number;
  canvas?: CanvasSize;
  window?: CanvasWindow;
}) {
  const { colors } = useTheme();
  if (paper === 'plain') return null;
  const win = window ?? { x: 0, y: 0, w: width, h: height };
  if (paper === 'grid') return <NoteDots canvas={canvas} width={width} window={win} />;

  const scale = width / canvas.w;
  const top = win.y / scale;
  const bottom = (win.y + win.h) / scale;
  let d = '';
  for (let y = FIRST_LINE; y < canvas.h; y += LINE_GAP) {
    if (y >= top - LINE_GAP && y <= bottom + LINE_GAP) d += `M0 ${y}H${canvas.w}`;
  }
  return (
    <Svg
      style={{ position: 'absolute', left: win.x, top: win.y }}
      width={win.w}
      height={win.h}
      viewBox={`${win.x / scale} ${top} ${win.w / scale} ${win.h / scale}`}
      pointerEvents="none"
    >
      <Path d={d} stroke={colors.line} strokeWidth={1.5} fill="none" />
      <Line x1={MARGIN_X} y1={0} x2={MARGIN_X} y2={canvas.h} stroke={colors.dangerSoft} strokeWidth={2} />
    </Svg>
  );
}
