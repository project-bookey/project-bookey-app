/**
 * 노트 캔버스 순수 기하 — 획 경로 문자열, 점 솎기, 지우개 히트테스트. 화면·테마와 무관하고 전부 논리 좌표다.
 */
import type { InkElement } from './noteDoc';

export type Point = [number, number];

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 점 배열 → SVG path. 인접 점의 중점을 지나는 2차 곡선(Q)으로 잇는다 — 값싸고 충분히 부드럽다.
 * 점이 하나면 아주 짧은 선으로 만들어 둥근 캡이 점으로 찍히게 한다.
 */
export function pointsToPath(points: readonly Point[]): string {
  const n = points.length;
  if (n === 0) return '';
  const [x0, y0] = points[0];
  if (n === 1) return `M${r1(x0)} ${r1(y0)}L${r1(x0 + 0.1)} ${r1(y0)}`;
  if (n === 2) return `M${r1(x0)} ${r1(y0)}L${r1(points[1][0])} ${r1(points[1][1])}`;
  let d = `M${r1(x0)} ${r1(y0)}`;
  for (let i = 1; i < n - 1; i++) {
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    d += `Q${r1(cx)} ${r1(cy)} ${r1((cx + nx) / 2)} ${r1((cy + ny) / 2)}`;
  }
  const [lx, ly] = points[n - 1];
  d += `L${r1(lx)} ${r1(ly)}`;
  return d;
}

/** 캡처 중 솎기 — 마지막 점에서 minDist 논리 단위 안이면 버린다. */
export function farEnough(last: Point | undefined, next: Point, minDist = 2): boolean {
  if (!last) return true;
  const dx = next[0] - last[0];
  const dy = next[1] - last[1];
  return dx * dx + dy * dy >= minDist * minDist;
}

export function distToSegmentSq(p: Point, a: Point, b: Point): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const wx = p[0] - a[0];
  const wy = p[1] - a[1];
  const len = vx * vx + vy * vy;
  let t = len === 0 ? 0 : (wx * vx + wy * vy) / len;
  t = clamp(t, 0, 1);
  const dx = p[0] - (a[0] + t * vx);
  const dy = p[1] - (a[1] + t * vy);
  return dx * dx + dy * dy;
}

/** Ramer–Douglas–Peucker 단순화 — 커밋 시 한 번. epsilon 은 논리 단위. */
export function simplifyRdp(points: readonly Point[], epsilon = 1): Point[] {
  if (points.length <= 2) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  const epsSq = epsilon * epsilon;
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distToSegmentSq(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > epsSq) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/** 획의 경계 상자(논리). 지우개가 먼저 이걸로 거른다. */
export function strokeBounds(points: readonly Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** 점 p 가 획에서 tol 안에 있는지 — 경계 상자로 먼저 거르고 선분 거리로 판정한다. */
export function strokeHit(stroke: Pick<InkElement, 'points' | 'width'>, p: Point, tol: number): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  const reach = tol + stroke.width / 2;
  const b = strokeBounds(pts);
  if (p[0] < b.minX - reach || p[0] > b.maxX + reach || p[1] < b.minY - reach || p[1] > b.maxY + reach) return false;
  const reachSq = reach * reach;
  if (pts.length === 1) {
    const dx = p[0] - pts[0][0];
    const dy = p[1] - pts[0][1];
    return dx * dx + dy * dy <= reachSq;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegmentSq(p, pts[i], pts[i + 1]) <= reachSq) return true;
  }
  return false;
}

/** 회전한 박스의 중심을 지나는 벡터로 크기·각도 변화를 계산한다(모서리 핸들용). */
export function handleDelta(center: Point, from: Point, to: Point): { scale: number; rotDeg: number } {
  const ax = from[0] - center[0];
  const ay = from[1] - center[1];
  const bx = to[0] - center[0];
  const by = to[1] - center[1];
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  const scale = la < 1e-6 ? 1 : lb / la;
  const rotDeg = ((Math.atan2(by, bx) - Math.atan2(ay, ax)) * 180) / Math.PI;
  return { scale, rotDeg };
}
