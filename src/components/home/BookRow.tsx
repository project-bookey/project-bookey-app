import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, sans, spacing, typeScale, useTheme } from '@/theme';

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

/** 가로 표지 캐러셀 행. 데이터가 비어도 행 골격은 유지한다 — onPressEmpty가 있으면 + 타일, 없으면 유령 표지. */
export function BookRow({ title, books, loading, onPressBook, onPressAll, onPressEmpty }: {
  title: string;
  books: RowBook[];
  loading?: boolean;
  onPressBook: (book: RowBook) => void;
  onPressAll?: () => void;
  /** 빈 행의 + 타일 이동 대상 — 없으면 '준비 중' 유령 표지로 대체 */
  onPressEmpty?: () => void;
}) {
  const { colors } = useTheme();
  const empty = !loading && books.length === 0;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[typeScale.section, { color: colors.text }]}>{title}</Text>
        {onPressAll && !empty ? (
          <Pressable onPress={onPressAll} hitSlop={8} accessibilityRole="button" accessibilityLabel="전체보기">
            <Text style={[typeScale.label, { color: colors.textMuted }]}>전체보기 ›</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.cover, { backgroundColor: colors.surface }]} />
          ))}
        </View>
      ) : empty && onPressEmpty ? (
        <View style={styles.list}>
          <Pressable onPress={onPressEmpty} accessibilityRole="button" accessibilityLabel="책 추가">
            <View style={[styles.cover, styles.ghost, { borderColor: colors.lineStrong }]}>
              <Text style={[typeScale.title, { color: colors.textMuted }]}>+</Text>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>책 추가</Text>
            </View>
          </Pressable>
        </View>
      ) : empty ? (
        <View style={styles.emptyWrap}>
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.cover, styles.ghost, { borderColor: colors.lineStrong }]} />
            ))}
          </View>
          <Text style={[typeScale.caption, styles.emptyNote, { color: colors.textMuted }]}>
            아직 준비 중이에요
          </Text>
        </View>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={books}
          keyExtractor={(b) => b.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => onPressBook(item)} style={styles.item} accessibilityRole="button" accessibilityLabel={item.title}>
              <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
                {item.coverUrl ? (
                  <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <Text numberOfLines={3} style={[typeScale.caption, styles.coverFallback, { color: colors.textMuted }]}>
                    {item.title}
                  </Text>
                )}
                {item.rank != null ? (
                  <View style={[styles.rank, { backgroundColor: colors.scrimDim }]}>
                    <Text style={[typeScale.label, { color: '#F5F5F5' }]}>{item.rank}</Text>
                  </View>
                ) : null}
                {item.progress != null ? (
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round(item.progress * 100)}%`, backgroundColor: colors.accent }]} />
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={[typeScale.caption, styles.metaTitle, { color: colors.text }]}>
                {item.title}
              </Text>
              {item.author ? (
                <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>
                  {item.author}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
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
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, flexDirection: 'row' },
  item: { width: COVER_W },
  metaTitle: { fontFamily: sans.semiBold, marginTop: spacing.xs },
  cover: { width: COVER_W, height: COVER_H, borderRadius: radius.sm, overflow: 'hidden' },
  coverFallback: { padding: spacing.sm },
  rank: {
    position: 'absolute',
    top: 0,
    left: 0,
    minWidth: 22,
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderBottomRightRadius: radius.sm,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  fill: { height: 3 },
  ghost: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emptyWrap: { gap: spacing.sm },
  emptyNote: { paddingHorizontal: spacing.lg },
});
