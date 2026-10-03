import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { clubApi } from '@/api/endpoints';
import type { ClubPreview } from '@/api/types';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';
import { ClubBackdrop } from '@/components/club';
import { linkLabel } from '@/components/ui';

/**
 * 홈 추천 클럽 행 — 공개 클럽 카드 + 맨 끝 '+ 클럽 만들기' 타일.
 * 클럽은 책 한 권에 묶이지 않으므로 카드 위 띠는 책 표지 대신 클럽 배경(사진, 없으면 기본 배경), 아래는 이름 · 한 줄 소개 · 인원.
 * 탭 제거 후 유일한 클럽 생성 진입점이므로 0건·오류여도 섹션을 유지한다.
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
          <Text style={[typeScale.titleSerif, styles.title, { color: colors.text }]}>추천 클럽</Text>
        </View>
        <Pressable onPress={() => router.navigate('/clubs')} hitSlop={8} accessibilityRole="button" accessibilityLabel="전체보기">
          <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>{linkLabel('전체보기')}</Text>
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
            accessibilityLabel="클럽 만들기"
            style={[styles.card, styles.createTile, { borderColor: colors.lineStrong }]}
          >
            <Text style={[typeScale.titleSerif, { color: colors.textMuted }]}>+</Text>
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>클럽 만들기</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            style={[styles.card, { backgroundColor: colors.surface }]}
          >
            <View style={styles.band}>
              <ClubBackdrop uri={item.backgroundUrl} seed={item.id} />
            </View>
            <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>{item.name}</Text>
            {item.description ? (
              <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>{item.description}</Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                인원{' '}
                <Text style={styles.count}>
                  {item.memberCount}/{item.memberLimit}
                </Text>
              </Text>
              <View style={[styles.badge, {
                backgroundColor: item.status === 'RECRUITING' ? colors.ink : colors.surfaceRaised,
              }]}>
                <Text style={[typeScale.monoEyebrow, {
                  color: item.status === 'RECRUITING' ? colors.onInk : colors.textMuted,
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
  // 카드 폭에 맞춘 띠 — 배경 사진이 없으면 기본 배경(ClubBackdrop).
  band: { height: 64, borderRadius: radius.sm, overflow: 'hidden', marginBottom: spacing.xs },
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
