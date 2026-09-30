import { useEffect, useRef, useState } from 'react';
import {
  FlatList, Platform, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';

import { NoteCanvas, ZoomStage, pageDocOf, useNoteZoom, type PostNoteDoc } from '@/components/note';
import { PageStrip } from '@/components/note/PageStrip';
import { spacing } from '@/theme';

/** 상세에서 페이지 폭 상한(px) — 넓은 화면(웹)에서 종이가 끝없이 커지지 않게. */
const MAX_PAGE_W = 520;

/**
 * 노트 독후감 보기 — 좌우로 넘기는 읽기 전용 페이지들. 페이지가 둘 이상이면 아래에 ‹ N / M › 줄.
 * 대형노트는 지금 페이지를 ZoomStage 에 얹는다(핀치·− 맞춤 +, 확대 중엔 끌어서 보고 스와이프는 멈춘다).
 */
export function NoteViewer({ doc }: { doc: PostNoteDoc }) {
  const [width, setWidth] = useState(0);
  const [rawIndex, setIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);
  const count = doc.pages.length;
  // 고친 글이 캐시로 들어와 페이지가 줄어도 범위 안에 선다.
  const index = Math.min(rawIndex, Math.max(count - 1, 0));
  const pageWidth = Math.floor(Math.min(width, MAX_PAGE_W));
  const zoom = useNoteZoom({ kind: doc.kind, baseWidth: pageWidth, panEnabled: true });
  const { fit } = zoom;

  // 페이지를 넘기면 맞춤으로 돌아간다.
  useEffect(() => {
    fit();
  }, [index, fit]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const go = (next: number) => {
    if (next < 0 || next >= count || next === index) return;
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  };

  const onSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index && next >= 0 && next < count) setIndex(next);
  };
  // 웹(react-native-web)은 onMomentumScrollEnd 를 내지 않는다 — 스크롤이 멈추면 같은 계산을 한다.
  const webSettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (webSettle.current) clearTimeout(webSettle.current);
  }, []);
  const onWebScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (webSettle.current) clearTimeout(webSettle.current);
    webSettle.current = setTimeout(() => {
      if (width <= 0) return;
      const next = Math.min(Math.max(Math.round(x / width), 0), count - 1);
      setIndex(next);
    }, 150);
  };

  return (
    <View style={styles.wrap}>
      <View onLayout={onLayout}>
        {width > 0 ? (
          <FlatList
            ref={listRef}
            key={width}
            data={doc.pages.map((p) => p.id)}
            horizontal
            pagingEnabled
            keyExtractor={(id) => id}
            extraData={`${index}:${zoom.zoom}`}
            renderItem={({ index: i }) => (
              <View style={[styles.slide, { width }]}>
                {i === index && zoom.enabled ? (
                  <ZoomStage zoom={zoom}>{(w) => <NoteCanvas doc={pageDocOf(doc, i)} width={w} />}</ZoomStage>
                ) : (
                  <NoteCanvas doc={pageDocOf(doc, i)} width={pageWidth} />
                )}
              </View>
            )}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            // 폭이 바뀌어 다시 마운트돼도(회전·창 크기) 보던 페이지에 선다.
            initialScrollIndex={index}
            scrollEnabled={count > 1 && !zoom.isZoomed}
            onMomentumScrollEnd={onSwipeEnd}
            onScroll={Platform.OS === 'web' ? onWebScroll : undefined}
            scrollEventThrottle={Platform.OS === 'web' ? 32 : undefined}
            showsHorizontalScrollIndicator={false}
            windowSize={3}
            initialNumToRender={1}
          />
        ) : null}
      </View>
      {count > 1 ? <PageStrip index={index} count={count} onPrev={() => go(index - 1)} onNext={() => go(index + 1)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  slide: { alignItems: 'center' },
});
