import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { TiltCover, useCoverEntrance } from '@/components/collage';
import { useTheme } from '@/theme';
import { hairline, radius, rowOffsetY, sans, spacing, tiltFor, typeScale } from '@/theme/tokens';

export type RowBook = {
  key: string;
  bookId?: number;
  title: string;
  /** 표지 아래 작가 줄 — 없으면 줄 자체를 그리지 않는다 (추천·인기 행에서 사용) */
  author?: string;
  coverUrl?: string;
  /** 0~1 — 읽는 중 행의 진행률 오버레이 */
  progress?: number;
  /** 인기 행의 순위 (1부터) */
  rank?: number;
};

const COVER_W = 96;
const COVER_H = 144;
/** 지그재그 최대 낙차 — 행 아래 여백을 이만큼 더 준다. */
const MAX_OFFSET = Math.max(...rowOffsetY);
/**
 * 랭크 배지(top -10)와 기울어진 표지의 위쪽 모서리가 스크롤 뷰에 잘리지 않게 두는 여백.
 * 배지 10 + 기울기로 올라오는 모서리 약 5 를 합쳐 잡는다.
 */
const BADGE_BLEED = 16;

/** 가로 표지 캐러셀 행. 데이터가 비어도 행 골격은 유지한다 — onPressEmpty가 있으면 + 타일, 없으면 유령 표지. */
export function BookRow({ title, label, books, loading, staggered = false, onPressBook, onPressAll, onPressEmpty }: {
  title: string;
  /** 제목 옆 모노 악센트 라벨 (예: LIVE) */
  label?: string;
  books: RowBook[];
  loading?: boolean;
  /**
   * 표지를 지그재그로 흩는다 — 기울기 + 세로 오프셋.
   * 홈에서는 한 행에만 준다(전 행에 주면 과밀해 읽기 어렵다).
   */
  staggered?: boolean;
  onPressBook: (book: RowBook) => void;
  onPressAll?: () => void;
  /** 빈 행의 + 타일 이동 대상 — 없으면 '준비 중' 유령 표지로 대체 */
  onPressEmpty?: () => void;
}) {
  const { colors } = useTheme();
  const empty = !loading && books.length === 0;
  const listStyle = [styles.list, staggered ? styles.listStaggered : null];

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headTitle}>
          <Text style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>{title}</Text>
          {label ? (
            <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>{label}</Text>
          ) : null}
        </View>
        {onPressAll && !empty ? (
          <Pressable onPress={onPressAll} hitSlop={8} accessibilityRole="button" accessibilityLabel="전체보기">
            <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>전체보기 ›</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={listStyle}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.cover, { backgroundColor: colors.surface }]} />
          ))}
        </View>
      ) : empty && onPressEmpty ? (
        <View style={listStyle}>
          <Pressable onPress={onPressEmpty} accessibilityRole="button" accessibilityLabel="책 추가">
            <View style={[styles.cover, styles.ghost, { borderColor: colors.lineStrong }]}>
              <Text style={[typeScale.titleSerif, { color: colors.textMuted }]}>+</Text>
              <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>책 추가</Text>
            </View>
          </Pressable>
        </View>
      ) : empty ? (
        <View style={styles.emptyWrap}>
          <View style={listStyle}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.cover, styles.ghost, { borderColor: colors.lineStrong }]} />
            ))}
          </View>
          <Text style={[typeScale.monoLabel, styles.emptyNote, { color: colors.textFaint }]}>
            아직 준비 중이에요
          </Text>
        </View>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={books}
          keyExtractor={(b) => b.key}
          contentContainerStyle={listStyle}
          renderItem={({ item, index }) => (
            <RowItem
              item={item}
              index={index}
              rowTitle={title}
              staggered={staggered}
              onPress={() => onPressBook(item)}
            />
          )}
        />
      )}
    </View>
  );
}

/**
 * 행의 한 칸 — 표지 + 그 아래 제목·저자.
 *
 * 표지와 활자는 같은 `entranceKey`·`index` 로 입장 진행값을 공유한다. 활자만 먼저
 * 떠 있다가 표지가 뒤늦게 앉는 어긋남을 막고, 두 번째 마운트부터는 둘 다 조용히
 * 정착 상태로 시작한다(1회성 가드도 한 벌만 쓴다).
 */
function RowItem({ item, index, rowTitle, staggered, onPress }: {
  item: RowBook;
  index: number;
  rowTitle: string;
  staggered: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const offsetY = staggered ? rowOffsetY[index % rowOffsetY.length] : 0;
  // 세션당 1회만 입장한다 — 탭을 오갈 때마다 재생되면 과하다.
  const entranceKey = `${rowTitle}:${item.bookId ?? item.key}`;
  const metaProgress = useCoverEntrance(index, entranceKey);
  const metaStyle = useAnimatedStyle(() => ({ opacity: metaProgress.value }));

  return (
    <View style={styles.item}>
      <TiltCover
        uri={item.coverUrl}
        title={item.title}
        width={COVER_W}
        index={index}
        tilt={staggered ? tiltFor(index) : 0}
        offsetY={offsetY}
        entranceKey={entranceKey}
        onPress={onPress}
        // 아래 활자를 접근성 트리에서 감췄으므로 저자까지 이 라벨에 합친다.
        accessibilityLabel={item.author ? `${item.title}, ${item.author}` : item.title}
      >
        {item.rank != null ? (
          <View pointerEvents="none" style={[styles.rank, { backgroundColor: colors.accent }]}>
            <Text style={[typeScale.monoNumeral, { color: colors.onAccent }]}>{item.rank}</Text>
          </View>
        ) : null}
        {item.progress != null ? (
          <View pointerEvents="none" style={[styles.track, { backgroundColor: colors.scrimDim }]}>
            <View
              style={[
                styles.fill,
                { width: `${Math.round(item.progress * 100)}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
        ) : null}
      </TiltCover>

      {/* 표지가 내려간 만큼 아래 활자도 같이 내린다 — 한 조각처럼 읽히게.
          표지 버튼이 이미 제목·저자를 읽어 주므로 여기는 접근성 트리에서 감춘다. */}
      <Animated.View style={[styles.meta, offsetY ? { transform: [{ translateY: offsetY }] } : null, metaStyle]}>
        <Pressable
          onPress={onPress}
          // aria-hidden 은 RN 이 네이티브의 accessibilityElementsHidden·
          // importantForAccessibility 로, 웹이 그대로 aria-hidden 으로 옮긴다.
          aria-hidden
          focusable={false}
          style={styles.metaTap}
        >
          <Text numberOfLines={1} style={[typeScale.caption, styles.metaTitle, { color: colors.text }]}>
            {item.title}
          </Text>
          {item.author ? (
            <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textFaint }]}>
              {item.author}
            </Text>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
  },
  headTitle: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexShrink: 1 },
  title: { fontSize: 18, lineHeight: 26 },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md, flexDirection: 'row' },
  // 지그재그 행에만: 위는 걸친 랭크 배지, 아래는 내려간 표지만큼 여백을 더 둔다.
  // (배지도 지그재그도 없는 행에 같은 여백을 주면 행 간격이 들쭉날쭉해진다.)
  listStaggered: { paddingTop: BADGE_BLEED, paddingBottom: MAX_OFFSET },
  item: { width: COVER_W },
  meta: { marginTop: spacing.sm },
  metaTap: { gap: 2 },
  metaTitle: { fontFamily: sans.semiBold },
  cover: { width: COVER_W, height: COVER_H, borderRadius: radius.sm, overflow: 'hidden' },
  rank: {
    position: 'absolute',
    top: -10,
    left: -8,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  fill: { height: 3 },
  ghost: {
    borderWidth: hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emptyWrap: { gap: spacing.sm },
  emptyNote: { paddingHorizontal: spacing.lg },
});
