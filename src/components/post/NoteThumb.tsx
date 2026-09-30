import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Post } from '@/api/types';
import { CANVAS, NoteCanvas, canvasOf, contentBounds, pageDocOf, pageHeightFor, type NoteDoc, type NoteRect } from '@/components/note';
import { radius } from '@/theme';
import { noteDocOf } from './postFormat';

/** 대형노트 썸네일에서 쓴 구역 둘레에 둘 여백(논리 단위). */
const CROP_MARGIN = 80;

/**
 * 대형노트에서 썸네일로 잘라 낼 구역 — 쓴 구역을 감싸는 3:4 상자(격자노트 한 쪽보다 작게는 자르지 않는다).
 * 종이 밖으로 나가면 안으로 밀어 넣는다. 비었으면 종이 한가운데 한 쪽.
 */
function cropOf(doc: NoteDoc): NoteRect {
  const canvas = canvasOf(doc);
  const ratio = CANVAS.h / CANVAS.w;
  const b = contentBounds(doc) ?? { x: canvas.w / 2, y: canvas.h / 2, w: 0, h: 0 };
  let w = Math.max(b.w + CROP_MARGIN * 2, (b.h + CROP_MARGIN * 2) / ratio, CANVAS.w);
  w = Math.min(w, canvas.w, canvas.h / ratio);
  const h = w * ratio;
  const x = Math.min(Math.max(b.x + b.w / 2 - w / 2, 0), canvas.w - w);
  const y = Math.min(Math.max(b.y + b.h / 2 - h / 2, 0), canvas.h - h);
  return { x, y, w, h };
}

/**
 * 노트 독후감 썸네일 — 1쪽을 격자노트 비율(3:4)로 줄여 그린다(읽기 전용, 눌림은 바깥 몫).
 * 대형노트는 종이 전체를 줄이면 거의 빈 종이라, 쓴 구역만 잘라 보여 준다(SVG 층은 그 창만 그린다).
 */
export function NoteThumb({ post, width }: { post: Pick<Post, 'document'>; width: number }) {
  const doc = useMemo(() => pageDocOf(noteDocOf(post), 0), [post]);
  const height = pageHeightFor(width, 'grid');
  const crop = useMemo(() => (doc.kind === 'large' ? cropOf(doc) : null), [doc]);
  if (!crop) {
    return (
      <View pointerEvents="none" style={[styles.thumb, { width, height }]}>
        <NoteCanvas doc={doc} width={width} />
      </View>
    );
  }
  const canvas = canvasOf(doc);
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
