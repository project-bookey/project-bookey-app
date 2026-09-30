import { memo, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme';
import { CANVAS, penColorOf, type CanvasSize, type CanvasWindow, type InkElement, type PenColor } from './noteDoc';
import { pointsToPath, type Point } from './noteGeometry';

/** 그리는 중인 획 — 아직 문서에 들어가기 전. */
export type LiveStroke = { points: Point[]; color: PenColor; width: number };

type Group = { key: string; color: PenColor; width: number; d: string };

/** 같은 (색, 굵기) 획은 path 하나로 이어 붙인다 — 획이 수백 개여도 네이티브 노드는 몇 개뿐. */
function groupStrokes(strokes: readonly InkElement[]): Group[] {
  const map = new Map<string, Group>();
  for (const s of strokes) {
    const key = `${s.color}|${s.width}`;
    const d = pointsToPath(s.points);
    const g = map.get(key);
    if (g) g.d += d;
    else map.set(key, { key, color: s.color, width: s.width, d });
  }
  return [...map.values()];
}

/**
 * 잉크 층 — Svg 하나에 viewBox 를 논리 캔버스로 잡아 scale 을 신경 쓰지 않는다.
 * 사용자 손글씨라 둥근 캡을 쓴다(각진 캡은 크롬 아이콘 규칙이지 잉크 규칙이 아니다).
 * 항상 요소 위에 그려진다 — 사진에 동그라미 치고 글에 밑줄 긋는 주석 느낌이 의도다.
 * canvas 는 문서의 논리 크기(대형노트 5000×5000) — 생략하면 격자 크기.
 * window(px) 를 주면 그 구역 크기의 SVG 에 viewBox 를 그 구역의 논리 좌표로 잡아 그린다 — 큰 종이를 통째로 SVG 로 만들지 않는다.
 */
export const InkLayer = memo(function InkLayer({ strokes, width, height, live, canvas = CANVAS, window }: {
  strokes: readonly InkElement[];
  width: number;
  height: number;
  live?: LiveStroke | null;
  canvas?: CanvasSize;
  window?: CanvasWindow;
}) {
  const { colors } = useTheme();
  const pen = penColorOf(colors);
  const groups = useMemo(() => groupStrokes(strokes), [strokes]);
  const win = window ?? { x: 0, y: 0, w: width, h: height };
  const scale = width / canvas.w;
  return (
    <Svg
      style={{ position: 'absolute', left: win.x, top: win.y }}
      width={win.w}
      height={win.h}
      viewBox={`${win.x / scale} ${win.y / scale} ${win.w / scale} ${win.h / scale}`}
      pointerEvents="none"
    >
      {groups.map((g) => (
        <Path
          key={g.key}
          d={g.d}
          stroke={pen[g.color]}
          strokeWidth={g.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
      {live && live.points.length > 0 ? (
        <Path
          d={pointsToPath(live.points)}
          stroke={pen[live.color]}
          strokeWidth={live.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
    </Svg>
  );
});
