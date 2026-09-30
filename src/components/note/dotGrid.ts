/** 도트 간격·반지름(논리 단위) — 격자·대형노트가 같은 값이다. */
export const DOT_GAP = 40;
export const DOT_R = 2.5;
/** 화면에서 점이 사라지지 않게 하는 최소 반지름(px). */
export const DOT_MIN_PX = 1;
/** 점 사이가 이보다 좁아지면(px) 점을 성기게 찍는다 — 대형노트를 줄여 볼 때 점이 회색 얼룩으로 뭉개지지 않게. */
const MIN_GAP_PX = 7;
/** 성기게 찍을 때의 배수 — 다섯 칸마다 한 점, 그래도 좁으면 스물다섯 칸마다. */
const LOD_STEP = 5;

/**
 * 배율(px/논리 단위)에 맞는 점 간격(논리 단위)과 반지름(px). 간격은 늘 DOT_GAP 의 배수라
 * 성기게 찍어도 남는 점은 원래 자리 그대로다(줌하면 사이 점이 다시 채워진다).
 */
export function dotGridFor(scale: number): { gap: number; rPx: number } {
  const s = Math.max(scale, 1e-6);
  let gap = DOT_GAP;
  while (gap * s < MIN_GAP_PX) gap *= LOD_STEP;
  return { gap, rPx: Math.max(DOT_R * s, DOT_MIN_PX) };
}
