import { useMemo, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/theme';
import { hairline } from '@/theme/tokens';
import { InkLayer, type LiveStroke } from './InkLayer';
import { NoteElementView } from './NoteElementView';
import { NotePaper } from './NotePaper';
import { canvasFor, canvasOf, isInk, isPlaced, sortByZ, type NoteDoc, type NoteKind, type PlacedElement } from './noteDoc';

/** 페이지 폭(px) → 논리 단위 배율. 높이는 3:4 로 따라온다. 대형노트는 논리 폭이 2000 이라 같은 폭에서 배율이 절반이다. */
export const scaleFor = (width: number, kind: NoteKind = 'grid') => width / canvasFor(kind).w;
/** 페이지 폭(px) → 페이지 높이(px). */
export const pageHeightFor = (width: number, kind: NoteKind = 'grid') => {
  const c = canvasFor(kind);
  return Math.round((width * c.h) / c.w);
};

/**
 * 페이지 한 장 — 종이 → (바탕 층) → z 순 요소 → 잉크(맨 위) 순으로 쌓는다.
 * captureRef 가 가리키는 안쪽 뷰가 PNG 로 찍히는 범위다. 편집 층(잉크 제스처·선택 프레임·업로드 중 사진)은
 * children 으로 받아 **캡처 뷰의 형제**로 얹는다 — 캡처 직전에 무엇을 숨길 필요가 없다.
 * renderElement 를 주면 요소를 그 함수로 그린다(선택 도구의 제스처 뷰). 없으면 읽기 전용 뷰.
 * 논리 캔버스 크기는 문서의 kind 가 정한다(canvasOf) — 대형노트는 2000×2666.
 */
export function NoteCanvas({ doc, width, live, captureRef, underlay, renderElement, children }: {
  doc: NoteDoc;
  width: number;
  live?: LiveStroke | null;
  captureRef?: RefObject<View | null>;
  /** 종이 바로 위, 요소 아래에 깔리는 층(바탕 탭). */
  underlay?: ReactNode;
  renderElement?: (element: PlacedElement, scale: number) => ReactNode;
  children?: ReactNode;
}) {
  const { colors, cardShadow } = useTheme();
  const canvas = canvasOf(doc);
  const scale = width / canvas.w;
  const height = Math.round(canvas.h * scale);
  const placed = useMemo(() => sortByZ(doc.elements.filter(isPlaced)), [doc.elements]);
  const strokes = useMemo(() => doc.elements.filter(isInk), [doc.elements]);

  return (
    <View style={{ width, height }}>
      <View
        ref={captureRef}
        collapsable={false}
        testID="note-page"
        style={[styles.page, { width, height, backgroundColor: colors.surface, borderColor: colors.line }, cardShadow]}
      >
        <NotePaper paper={doc.paper} width={width} height={height} canvas={canvas} />
        {underlay}
        {placed.map((e) => (renderElement ? renderElement(e, scale) : <NoteElementView key={e.id} element={e} scale={scale} />))}
        <InkLayer strokes={strokes} width={width} height={height} live={live} canvas={canvas} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { borderWidth: hairline, borderRadius: radius.md, overflow: 'hidden' },
});
