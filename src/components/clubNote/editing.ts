/**
 * 선택 도구의 미리보기 변환 — 드래그·핀치·회전·모서리 핸들이 진행 중일 때 문서는 그대로 두고
 * 선택된 요소에만 임시 델타를 얹어 그린다. 손을 떼면 델타를 문서에 적용(commit)하고 비운다.
 * 델타는 항상 "현재 문서의 요소" 기준이라 중간에 한 제스처가 먼저 끝나 커밋돼도 이어서 쌓을 수 있다.
 */
import { CANVAS, MAX_ELEMENT_W, MIN_ELEMENT_W, type PlacedElement } from './noteDoc';
import { clamp } from './noteGeometry';

/** dx·dy 는 px, s 는 배율, dr 은 도. */
export type Delta = { dx: number; dy: number; s: number; dr: number };
export type Preview = Delta & { id: string };
export const IDLE_DELTA: Delta = { dx: 0, dy: 0, s: 1, dr: 0 };

/** 델타를 얹은 요소 — 폭은 좌상단을 고정한 채 늘어난다(사진은 높이도 같은 비율로). */
export function applyPreview(el: PlacedElement, preview: Preview | null, scale: number): PlacedElement {
  if (!preview || preview.id !== el.id) return el;
  const w = clamp(el.w * preview.s, MIN_ELEMENT_W, MAX_ELEMENT_W);
  const base = { x: el.x + preview.dx / scale, y: el.y + preview.dy / scale, w, rot: el.rot + preview.dr };
  if (el.type === 'photo') return { ...el, ...base, h: el.h * (w / el.w) };
  return { ...el, ...base };
}

/** 페이지 밖으로 완전히 나가지 않게 붙들고, 각도를 -180~180 으로 정리한다. 커밋 직전에 한 번. */
export function settle(el: PlacedElement): PlacedElement {
  const keep = 40;
  const x = clamp(Math.round(el.x * 10) / 10, -el.w + keep, CANVAS.w - keep);
  const y = clamp(Math.round(el.y * 10) / 10, -keep, CANVAS.h - keep);
  let rot = Math.round(el.rot * 10) / 10;
  rot = ((((rot + 180) % 360) + 360) % 360) - 180;
  const w = Math.round(el.w * 10) / 10;
  if (el.type === 'photo') return { ...el, x, y, w, rot, h: Math.round(el.h * 10) / 10 };
  return { ...el, x, y, w, rot };
}
