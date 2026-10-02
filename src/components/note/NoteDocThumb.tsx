import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { NoteCanvas, pageHeightFor } from './NoteCanvas';
import { CANVAS, canvasOf, contentBounds, type NoteDoc, type NoteRect } from './noteDoc';
import { radius } from '@/theme';

/** 대형노트 썸네일에서 쓴 구역 둘레에 둘 여백(논리 단위). */
const CROP_MARGIN = 80;

/** 격자노트 한 쪽 비율(세로/가로) — 썸네일 기본값. */
const PAGE_RATIO = CANVAS.h / CANVAS.w;

/**
 * 대형노트에서 썸네일로 잘라 낼 구역 — 쓴 구역을 감싸는 ratio(세로/가로) 상자(격자노트 한 쪽 폭보다 작게는 자르지 않는다).
 * 종이 밖으로 나가면 안으로 밀어 넣는다. 비었으면 종이 한가운데.
 */
function cropOf(doc: NoteDoc, ratio: number): NoteRect {
  const canvas = canvasOf(doc);
  const b = contentBounds(doc) ?? { x: canvas.w / 2, y: canvas.h / 2, w: 0, h: 0 };
  let w = Math.max(b.w + CROP_MARGIN * 2, (b.h + CROP_MARGIN * 2) / ratio, CANVAS.w);
  w = Math.min(w, canvas.w, canvas.h / ratio);
  const h = w * ratio;
  const x = Math.min(Math.max(b.x + b.w / 2 - w / 2, 0), canvas.w - w);
  const y = Math.min(Math.max(b.y + b.h / 2 - h / 2, 0), canvas.h - h);
  return { x, y, w, h };
}

/**
 * 노트 문서 썸네일. 대형노트는 ratio(세로/가로) 상자로 쓴 구역을 잘라 보여 준다 — 모임 노트 피드는 정사각(1).
 * 격자·줄노트는 비율과 상관없이 한 쪽 전체(3:4)를 그린다.
 */
export function NoteDocThumb({ doc, width, ratio = PAGE_RATIO }: { doc: NoteDoc; width: number; ratio?: number }) {
  const crop = useMemo(() => (doc.kind === 'large' ? cropOf(doc, ratio) : null), [doc, ratio]);
  if (!crop) {
    const height = pageHeightFor(width, 'grid');
    return (
      <View pointerEvents="none" style={[styles.thumb, { width, height }]}>
        <NoteCanvas doc={doc} width={width} />
      </View>
    );
  }
  const canvas = canvasOf(doc);
  const height = width * ratio;
  const scale = width / crop.w;
  const left = crop.x * scale;
  const top = crop.y * scale;
  return (
    <View pointerEvents="none" style={[styles.thumb, { width, height }]}>
      <View style={{ position: 'absolute', left: -left, top: -top }}>
        <NoteCanvas doc={doc} width={canvas.w * scale} window={{ x: left, y: top, w: width, h: height }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { overflow: 'hidden', borderRadius: radius.sm },
});
