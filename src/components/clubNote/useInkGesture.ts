import { useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import type { LiveStroke } from './InkLayer';
import {
  MAX_STROKES, MAX_STROKE_POINTS, addElement, newId, nextZ, removeElements,
  type InkElement, type NoteDoc, type PenColor, type PenWidth,
} from './noteDoc';
import { farEnough, simplifyRdp, strokeHit, type Point } from './noteGeometry';
import type { ApplyOptions } from './useNoteEditor';

export type InkTool = 'pen' | 'eraser';
export type PenState = { color: PenColor; width: PenWidth };

/** 지우개 반경(px) — 손가락 굵기쯤. 논리 단위로는 scale 로 나눈다. */
const ERASER_RADIUS_PX = 12;

/**
 * 펜·지우개 제스처 — 페이지 위 한 장의 Pan 이 전부다. 전부 JS 스레드에서 돈다(runOnJS):
 * 웹·네이티브가 같은 코드로 움직이고, 무거운 소비자는 path 문자열 하나뿐이라 충분하다.
 * 펜은 점을 모아 rAF 한 번에 라이브 획을 갱신하고, 손을 떼면 RDP 로 단순화해 문서에 넣는다.
 * 지우개는 지나간 자리에 걸린 획을 통째로 지운다 — 드래그 한 번이 되돌리기 한 건이다.
 */
export function useInkGesture({ tool, scale, pen, apply, endBatch, setLive, onLimit }: {
  tool: InkTool | null;
  scale: number;
  pen: PenState;
  apply: (mutate: (d: NoteDoc) => NoteDoc, opts?: ApplyOptions) => void;
  endBatch: () => void;
  setLive: (live: LiveStroke | null) => void;
  onLimit: (message: string) => void;
}) {
  const pointsRef = useRef<Point[]>([]);
  const rafRef = useRef<number | null>(null);
  const batchRef = useRef('');
  // 제스처 객체는 deps 가 바뀔 때만 다시 만들고, 콜백은 ref 로 최신 것을 본다.
  const latest = useRef({ pen, apply, endBatch, setLive, onLimit, scale });
  latest.current = { pen, apply, endBatch, setLive, onLimit, scale };

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return useMemo(() => {
    const flushLive = () => {
      rafRef.current = null;
      const { pen: p, setLive: set } = latest.current;
      set({ points: pointsRef.current.slice(), color: p.color, width: p.width });
    };
    const scheduleLive = () => {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushLive);
    };
    const toLogical = (x: number, y: number): Point => [x / latest.current.scale, y / latest.current.scale];

    const eraseAt = (pt: Point) => {
      const tol = ERASER_RADIUS_PX / latest.current.scale;
      latest.current.apply((d) => {
        const hit = new Set<string>();
        for (const e of d.elements) if (e.type === 'ink' && strokeHit(e, pt, tol)) hit.add(e.id);
        return removeElements(d, hit);
      }, { batch: batchRef.current });
    };

    const commitStroke = () => {
      const raw = pointsRef.current;
      if (raw.length === 0) return;
      const { pen: p, apply: run, onLimit: warn } = latest.current;
      const points = simplifyRdp(raw, 1).slice(0, MAX_STROKE_POINTS).map(([x, y]) => [
        Math.round(x * 10) / 10, Math.round(y * 10) / 10,
      ] as Point);
      run((d) => {
        if (d.elements.reduce((n, e) => (e.type === 'ink' ? n + 1 : n), 0) >= MAX_STROKES) {
          warn(`획이 너무 많아요 — 한 페이지에 ${MAX_STROKES}획까지 그릴 수 있어요.`);
          return d;
        }
        const stroke: InkElement = { id: newId(), z: nextZ(d), type: 'ink', color: p.color, width: p.width, points };
        return addElement(d, stroke);
      });
    };

    const reset = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      pointsRef.current = [];
      latest.current.setLive(null);
    };

    return Gesture.Pan()
      .enabled(tool !== null)
      .runOnJS(true)
      .minDistance(0)
      .maxPointers(1)
      .shouldCancelWhenOutside(false)
      .onBegin((e) => {
        const pt = toLogical(e.x, e.y);
        if (tool === 'pen') {
          pointsRef.current = [pt];
          scheduleLive();
        } else if (tool === 'eraser') {
          batchRef.current = `erase-${Date.now()}`;
          eraseAt(pt);
        }
      })
      .onUpdate((e) => {
        const pt = toLogical(e.x, e.y);
        if (tool === 'pen') {
          const pts = pointsRef.current;
          if (farEnough(pts[pts.length - 1], pt)) {
            pts.push(pt);
            scheduleLive();
          }
        } else if (tool === 'eraser') {
          eraseAt(pt);
        }
      })
      .onFinalize(() => {
        // 탭만 해도(활성화 없이 끝나도) 점 하나는 남긴다 — onBegin 에서 시작한 획을 여기서 마무리한다.
        if (tool === 'pen') commitStroke();
        else if (tool === 'eraser') latest.current.endBatch();
        reset();
      });
  }, [tool]);
}
