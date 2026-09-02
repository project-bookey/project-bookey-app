import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { ViewToken } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import type { ReadingRecord } from '@/api/types';
import { radius, spacing, useTheme } from '@/theme';
import { HeroCollage } from './HeroCollage';

/** 절반 넘게 보이는 장을 현재 페이지로 본다. */
const VIEWABILITY = { itemVisiblePercentThreshold: 50 } as const;

/**
 * 서가 히어로 페이저 — 읽는 중 기록이 여러 권이면 히어로 콜라주를 옆으로 쓸어넘겨 본다.
 *
 * 콜라주 자체는 손대지 않고 바깥에서 감싸기만 한다. 한 권(또는 로딩·0권)일 때는
 * 페이저를 아예 만들지 않고 예전처럼 콜라주 한 장만 그린다 — 도트도 붙지 않는다.
 */
export function HeroPager({
  records, synopses, page, onPageChange, streakLine, loading, scrollY, onContinue, onDetail,
}: {
  /** 히어로에 세울 읽는 중 기록 — 첫 원소가 첫 장이다(홈에서 정렬해 넘긴다). */
  records: ReadingRecord[];
  /** records 와 같은 순서의 줄거리. 아직 안 받은 장은 undefined. */
  synopses: (string | undefined)[];
  /** 현재 장(홈이 들고 있다 — 그 장의 상세를 미리 받는 데 쓴다) */
  page: number;
  onPageChange: (page: number) => void;
  streakLine?: string;
  loading?: boolean;
  scrollY: SharedValue<number>;
  onContinue: (record: ReadingRecord) => void;
  onDetail: (record: ReadingRecord) => void;
}) {
  const { colors } = useTheme();
  // 한 장의 폭 = 콜라주 판 폭. 화면 폭이 아니라 실제 컨테이너를 잰다(웹은 560 상한).
  const [width, setWidth] = useState(0);

  // FlatList 는 첫 렌더의 onViewableItemsChanged 를 붙잡아 둔다(바꾸면 런타임 에러) —
  // 최신 콜백은 ref 로 건네고 함수 정체성은 그대로 둔다.
  const pageChangeRef = useRef(onPageChange);
  useEffect(() => {
    pageChangeRef.current = onPageChange;
  }, [onPageChange]);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (index != null) pageChangeRef.current(index);
  }).current;

  // 로딩·0권·1권 — 예전 홈과 똑같이 콜라주 한 장(로딩 자리표시자·미렌더 판단은 콜라주가 한다).
  if (loading || records.length <= 1) {
    return (
      <HeroCollage
        record={records[0] ?? null}
        synopsis={synopses[0]}
        streakLine={streakLine}
        loading={loading}
        scrollY={scrollY}
        onContinue={onContinue}
        onDetail={onDetail}
      />
    );
  }

  const active = Math.min(Math.max(page, 0), records.length - 1);

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {width > 0 ? (
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={records}
          keyExtractor={(r) => String(r.id)}
          initialNumToRender={1}
          windowSize={3}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          viewabilityConfig={VIEWABILITY}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={({ item, index }) => (
            <View style={{ width }}>
              <HeroCollage
                record={item}
                synopsis={synopses[index]}
                streakLine={streakLine}
                scrollY={scrollY}
                onContinue={onContinue}
                onDetail={onDetail}
              />
            </View>
          )}
        />
      ) : null}

      {/* 페이지 인디케이터 — 배너 캐러셀과 같은 도트(활성만 길게·민트). */}
      <View style={styles.dots}>
        {records.map((r, i) => (
          <View
            key={r.id}
            style={[
              styles.dot,
              i === active ? { width: 12, backgroundColor: colors.accent } : { backgroundColor: colors.lineStrong },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { width: 4, height: 4, borderRadius: radius.pill },
});
