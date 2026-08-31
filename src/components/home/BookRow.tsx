import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typeScale, useTheme } from '@/theme';

export type RowBook = {
  key: string;
  bookId?: number;
  title: string;
  coverUrl?: string;
  /** 0~1 — 읽는 중 행의 진행률 오버레이 */
  progress?: number;
  /** 인기 행의 순위 (1부터) */
  rank?: number;
};

const COVER_W = 96;
const COVER_H = 144;

/** 가로 표지 캐러셀 행. 데이터가 비면 행 전체를 숨긴다. */
export function BookRow({ title, books, loading, onPressBook, onPressAll }: {
  title: string;
  books: RowBook[];
  loading?: boolean;
  onPressBook: (book: RowBook) => void;
  onPressAll?: () => void;
}) {
  const { colors } = useTheme();

  if (!loading && books.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[typeScale.section, { color: colors.text }]}>{title}</Text>
        {onPressAll ? (
          <Pressable onPress={onPressAll} hitSlop={8}>
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
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={books}
          keyExtractor={(b) => b.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => onPressBook(item)} style={styles.item}>
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
              <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted, marginTop: spacing.xs, width: COVER_W }]}>
                {item.title}
              </Text>
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
  cover: { width: COVER_W, height: COVER_H, borderRadius: radius.sm, overflow: 'hidden' },
  coverFallback: { padding: spacing.sm },
  rank: {
    position: 'absolute',
    top: 0,
    left: 0,
    minWidth: 22,
    alignItems: 'center',
    paddingVertical: 2,
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
});
