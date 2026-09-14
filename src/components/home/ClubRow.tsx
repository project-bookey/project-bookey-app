import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { clubApi } from '@/api/endpoints';
import type { ClubPreview } from '@/api/types';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

/**
 * 홈 추천 모임 행 — 공개 모임 카드 + 맨 끝 '+ 모임 만들기' 타일.
 * 탭 제거 후 유일한 모임 생성 진입점이므로 0건·오류여도 섹션을 유지한다.
 */
export function ClubRow() {
  const router = useRouter();
  const { colors } = useTheme();
  const clubs = useQuery({ queryKey: ['clubs', 'public'], queryFn: clubApi.publicClubs });

  const items = (clubs.data?.content ?? []).filter(
    (c) => (c.status === 'RECRUITING' || c.status === 'ACTIVE') && c.joinable,
  );

  const open = (club: ClubPreview) => {
    router.push(`/club/${club.id}`);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headTitle}>
          <Text style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>추천 모임</Text>
        </View>
        <Pressable onPress={() => router.navigate('/clubs')} hitSlop={8} accessibilityRole="button" accessibilityLabel="전체보기">
          <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>전체보기 ›</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={clubs.isLoading ? [] : items}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          clubs.isLoading ? (
            <View style={styles.skeletonRow}>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.card, { backgroundColor: colors.surface }]} />
              ))}
            </View>
          ) : null
        }
        ListFooterComponent={
          <Pressable
            onPress={() => router.push('/club/create')}
            accessibilityRole="button"
            accessibilityLabel="모임 만들기"
            style={[styles.card, styles.createTile, { borderColor: colors.lineStrong }]}
          >
            <Text style={[typeScale.titleSerif, { color: colors.textMuted }]}>+</Text>
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>모임 만들기</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            style={[styles.card, { backgroundColor: colors.surface }]}
          >
            <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]}>
              {item.book?.coverUrl ? (
                <Image source={{ uri: item.book.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Text numberOfLines={3} style={[typeScale.caption, styles.coverFallback, { color: colors.textMuted }]}>
                  {item.book?.title ?? item.name}
                </Text>
              )}
            </View>
            <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>{item.name}</Text>
            <View style={styles.metaRow}>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                인원{' '}
                <Text style={styles.count}>
                  {item.memberCount}/{item.memberLimit}
                </Text>
              </Text>
              <View style={[styles.badge, {
                backgroundColor: item.status === 'RECRUITING' ? colors.accentSoft : colors.surfaceRaised,
              }]}>
                <Text style={[typeScale.monoEyebrow, {
                  color: item.status === 'RECRUITING' ? colors.accent : colors.textMuted,
                }]}>
                  {item.status === 'RECRUITING' ? '모집 중' : '진행 중'}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
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
  // 표지 행(BookRow)과 같은 머리글 크기 — 홈에서 섹션 위계가 어긋나지 않게.
  title: { fontSize: 18, lineHeight: 26 },
  count: { fontFamily: mono.regular, fontSize: 11 },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  skeletonRow: { flexDirection: 'row', gap: spacing.sm },
  card: { width: 150, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  cover: { width: 52, height: 78, borderRadius: radius.sm, overflow: 'hidden', marginBottom: spacing.xs },
  coverFallback: { padding: spacing.xs },
  createTile: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
});
