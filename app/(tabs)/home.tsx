import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';

import { bannerApi, bookApi, libraryApi, statsApi } from '@/api/endpoints';
import type { ReadingRecord } from '@/api/types';
import { formatDuration } from '@/components/ui';
import { BannerCarousel } from '@/components/home/BannerCarousel';
import { BookRow, RowBook } from '@/components/home/BookRow';
import { HeroContinue } from '@/components/home/HeroContinue';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 탭 1. 홈 — OTT 구성: 검색 바 → 이벤트 배너 → 히어로(읽는 중일 때만) → 표지 행 4개 (홈 리디자인·빈 섹션 스펙) */
export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const reading = useQuery({ queryKey: ['library', 'READING'], queryFn: () => libraryApi.list('READING') });
  const want = useQuery({ queryKey: ['library', 'WANT_TO_READ'], queryFn: () => libraryApi.list('WANT_TO_READ') });
  const stats = useQuery({ queryKey: ['stats', 30], queryFn: () => statsApi.summary(30) });
  const banners = useQuery({ queryKey: ['banners'], queryFn: bannerApi.list });
  const popular = useQuery({ queryKey: ['home', 'popular'], queryFn: () => bookApi.popular() });
  const recommended = useQuery({ queryKey: ['home', 'recommended'], queryFn: () => bookApi.recommended() });

  const records = reading.data?.content ?? [];
  const hero = pickHero(records);
  const streakLine = stats.data
    ? `${stats.data.currentStreakDays ?? 0}일 연속 · 오늘 ${formatDuration(stats.data.todayDurationSec ?? 0)}`
    : undefined;

  const refreshing =
    reading.isFetching || want.isFetching || stats.isFetching ||
    banners.isFetching || popular.isFetching || recommended.isFetching;
  const refetchAll = () => {
    reading.refetch(); want.refetch(); stats.refetch();
    banners.refetch(); popular.refetch(); recommended.refetch();
  };

  const openBook = (b: RowBook) => {
    if (b.bookId != null) router.push(`/book/${b.bookId}`);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} />}
    >
      <Pressable
        onPress={() => router.push('/search')}
        style={[styles.searchBar, { borderColor: colors.lineStrong }]}
        accessibilityRole="button"
        accessibilityLabel="책 검색"
      >
        <Text style={[typeScale.body, { color: colors.textMuted }]}>⌕ 책 제목·저자 검색</Text>
      </Pressable>

      <BannerCarousel banners={banners.data ?? []} />

      <HeroContinue
        record={hero}
        streakLine={streakLine}
        loading={reading.isLoading}
        onContinue={(r) => router.push(`/timer?recordId=${r.id}`)}
        onDetail={(r) => { if (r.book?.id != null) router.push(`/book/${r.book.id}?recordId=${r.id}`); }}
      />

      <BookRow
        title="읽는 중"
        loading={reading.isLoading}
        books={records.map((r): RowBook => ({
          key: `reading-${r.id}`,
          bookId: r.book?.id,
          title: r.book?.title ?? '',
          coverUrl: r.book?.coverUrl,
          progress: r.progress.completionRate ?? 0,
        }))}
        onPressBook={openBook}
        onPressAll={() => router.push('/(tabs)/library')}
        onPressEmpty={() => router.push('/search')}
      />

      <BookRow
        title="읽고 싶은"
        loading={want.isLoading}
        books={(want.data?.content ?? []).map((r): RowBook => ({
          key: `want-${r.id}`,
          bookId: r.book?.id,
          title: r.book?.title ?? '',
          coverUrl: r.book?.coverUrl,
        }))}
        onPressBook={openBook}
        onPressAll={() => router.push('/(tabs)/library')}
        onPressEmpty={() => router.push('/search')}
      />

      <BookRow
        title="추천"
        loading={recommended.isLoading}
        books={(recommended.data ?? []).map((b): RowBook => ({
          key: `pick-${b.id}`,
          bookId: b.id,
          title: b.title,
          coverUrl: b.coverUrl,
        }))}
        onPressBook={openBook}
      />

      <BookRow
        title="인기"
        loading={popular.isLoading}
        books={(popular.data ?? []).map((p, i): RowBook => ({
          key: `popular-${p.book.id}`,
          bookId: p.book.id,
          title: p.book.title,
          coverUrl: p.book.coverUrl,
          rank: i + 1,
        }))}
        onPressBook={openBook}
      />
    </ScrollView>
  );
}

/** 히어로 대상: 밀린 책(lagLevel 심각한 순) 우선, 없으면 최근 읽은 책. */
const LAG_RANK: Record<string, number> = {
  L4_NEGLECTED: 4, L3_SERIOUS: 3, L2_DELAYED: 2, L1_CAUTION: 1, L0_NORMAL: 0,
};

function pickHero(records: ReadingRecord[]): ReadingRecord | null {
  if (records.length === 0) return null;
  return [...records].sort((a, b) => {
    const lag = (LAG_RANK[b.progress.lagLevel ?? ''] ?? 0) - (LAG_RANK[a.progress.lagLevel ?? ''] ?? 0);
    if (lag !== 0) return lag;
    return (b.lastReadAt ?? '').localeCompare(a.lastReadAt ?? '');
  })[0];
}

const styles = StyleSheet.create({
  container: {
    ...layout.content,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  searchBar: {
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
});
