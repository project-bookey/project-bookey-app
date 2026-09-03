import { useIsFetching, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { bannerApi, bookApi, libraryApi, statsApi } from '@/api/endpoints';
import { POST_HOME_KEY } from '@/api/postCache';
import { PLAZA_HOME_KEY } from '@/api/quoteCache';
import type { ReadingRecord } from '@/api/types';
import { PaperScreen, SectionNav } from '@/components/collage';
import { formatDuration } from '@/components/ui';
import { BannerCarousel } from '@/components/home/BannerCarousel';
import { BookRow, RowBook } from '@/components/home/BookRow';
import { ChallengeRow } from '@/components/home/ChallengeRow';
import { ClubRow } from '@/components/home/ClubRow';
import { HeroPager } from '@/components/home/HeroPager';
import { HomeSection } from '@/components/home/HomeSection';
import { HomeScraps } from '@/components/home/HomeScraps';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 홈 — 검색 바 → 배너 → 히어로(읽는 중 전권) → 인기 → 오려둔 글 → 추천 → 읽고 싶은 → 챌린지 → 모임 */
export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const reading = useQuery({ queryKey: ['library', 'READING'], queryFn: () => libraryApi.list('READING') });
  const want = useQuery({ queryKey: ['library', 'WANT_TO_READ'], queryFn: () => libraryApi.list('WANT_TO_READ') });
  const stats = useQuery({ queryKey: ['stats', 30], queryFn: () => statsApi.summary(30) });
  const banners = useQuery({ queryKey: ['banners'], queryFn: bannerApi.list });
  const popular = useQuery({ queryKey: ['home', 'popular'], queryFn: () => bookApi.popular() });
  const recommended = useQuery({ queryKey: ['home', 'recommended'], queryFn: () => bookApi.recommended() });

  // 히어로는 읽는 중 전권을 쓸어넘기는 페이저다 — 첫 장이 예전 히어로(밀린 책 우선).
  const heroRecords = orderHeroRecords(reading.data?.content ?? []);
  const [heroPage, setHeroPage] = useState(0);
  // 히어로 뒤 메모장에 적을 줄거리 — 요약에는 없어 상세를 따로 읽는다(책 상세 화면과 캐시 키 공유).
  // 보고 있는 장과 그다음 한 장만 받는다 — 홈에 들어서자마자 권수만큼 상세를 부르지 않게.
  const heroBooks = useQueries({
    queries: heroRecords.map((r, i) => ({
      queryKey: ['book', r.book?.id],
      queryFn: () => bookApi.detail(r.book?.id as number),
      enabled: r.book?.id != null && i <= heroPage + 1,
    })),
  });
  const heroSynopses = heroBooks.map((q) => q.data?.description);
  const streakLine = stats.data
    ? `${stats.data.currentStreakDays ?? 0}일 연속 · 오늘 ${formatDuration(stats.data.todayDurationSec ?? 0)}`
    : undefined;

  // '오려둔 글' 쿼리(밑줄·독후감)는 HomeScraps 안에 있어 여기서 직접 못 본다 — 키로 조회해
  // 새로고침 인디케이터가 그 섹션이 다 돌 때까지 함께 남게 한다.
  const scrapsFetching =
    useIsFetching({ queryKey: PLAZA_HOME_KEY }) + useIsFetching({ queryKey: POST_HOME_KEY }) > 0;

  const refreshing =
    reading.isFetching || want.isFetching || stats.isFetching ||
    banners.isFetching || popular.isFetching || recommended.isFetching || scrapsFetching;
  const refetchAll = () => {
    reading.refetch(); want.refetch(); stats.refetch();
    banners.refetch(); popular.refetch(); recommended.refetch();
    queryClient.invalidateQueries({ queryKey: ['challenges'] });
    queryClient.invalidateQueries({ queryKey: ['plaza'] });
    queryClient.invalidateQueries({ queryKey: POST_HOME_KEY });
  };

  const openBook = (b: RowBook) => {
    if (b.bookId != null) router.push(`/book/${b.bookId}`);
  };

  // 히어로 패럴랙스용 스크롤 오프셋 — UI 스레드에서 바로 읽는다.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <PaperScreen>
      <SectionNav active="shelf" />
      <Animated.ScrollView
        contentContainerStyle={styles.container}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} />}
      >
        {/* 구역(서가·탐색·광장·나) 이동은 push 가 아니라 navigate 다 — push 하면
            서가↔탐색을 오갈 때마다 스택에 같은 구역이 쌓여 뒤로 가기가 길어진다. */}
        <Pressable
          onPress={() => router.navigate('/search')}
          style={[styles.searchBar, { borderColor: colors.lineStrong, backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel="책 검색"
        >
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>⌕</Text>
          <Text style={[typeScale.body, { color: colors.textFaint }]}>책 제목, 저자 검색</Text>
        </Pressable>

        <BannerCarousel banners={banners.data ?? []} />

        <HeroPager
          records={heroRecords}
          synopses={heroSynopses}
          page={heroPage}
          onPageChange={setHeroPage}
          streakLine={streakLine}
          loading={reading.isLoading}
          scrollY={scrollY}
          onContinue={(r) => router.push(`/timer?recordId=${r.id}`)}
          onDetail={(r) => { if (r.book?.id != null) router.push(`/book/${r.book.id}?recordId=${r.id}`); }}
        />

        {/* 섹션은 HomeSection 으로 감싸 괘선으로 나눈다 */}
        <HomeSection>
          <BookRow
            title="지금 붐비는 책"
            label="LIVE"
            staggered
            loading={popular.isLoading}
            books={(popular.data ?? []).map((p, i): RowBook => ({
              key: `popular-${p.book.id}`,
              bookId: p.book.id,
              title: p.book.title,
              author: p.book.author,
              coverUrl: p.book.coverUrl,
              rank: i + 1,
            }))}
            onPressBook={openBook}
          />
        </HomeSection>

        {/* '오려둔 글'만 섹션 틀을 제 안에서 두른다 — 밑줄·독후감이 둘 다 0건이면 통째로
            사라져야 하는데, 여기서 감싸면 괘선과 여백만 남는다(HomeScraps 주석 참고). */}
        <HomeScraps />

        <HomeSection>
          <BookRow
            title="추천"
            loading={recommended.isLoading}
            books={(recommended.data ?? []).map((b): RowBook => ({
              key: `pick-${b.id}`,
              bookId: b.id,
              title: b.title,
              author: b.author,
              coverUrl: b.coverUrl,
            }))}
            onPressBook={openBook}
          />
        </HomeSection>

        <HomeSection>
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
            onPressAll={() => router.push('/library')}
            onPressEmpty={() => router.navigate('/search')}
          />
        </HomeSection>

        <HomeSection>
          <ChallengeRow />
        </HomeSection>

        <HomeSection>
          <ClubRow />
        </HomeSection>
      </Animated.ScrollView>
    </PaperScreen>
  );
}

/** 히어로 대상: 밀린 책(lagLevel 심각한 순) 우선, 없으면 최근 읽은 책. */
const LAG_RANK: Record<string, number> = {
  L4_NEGLECTED: 4, L3_SERIOUS: 3, L2_DELAYED: 2, L1_CAUTION: 1, L0_NORMAL: 0,
};

/** 최근 활동순 — 마지막으로 읽은 시각 내림차순(ISO 문자열이라 사전순 비교로 충분). */
const byRecency = (a: ReadingRecord, b: ReadingRecord) =>
  (b.lastReadAt ?? '').localeCompare(a.lastReadAt ?? '');

function pickHero(records: ReadingRecord[]): ReadingRecord | null {
  if (records.length === 0) return null;
  return [...records].sort((a, b) => {
    const lag = (LAG_RANK[b.progress.lagLevel ?? ''] ?? 0) - (LAG_RANK[a.progress.lagLevel ?? ''] ?? 0);
    if (lag !== 0) return lag;
    return byRecency(a, b);
  })[0];
}

/** 히어로 페이저 순서: 첫 장은 예전과 같은 히어로(밀린 책), 나머지는 최근 활동순. */
function orderHeroRecords(records: ReadingRecord[]): ReadingRecord[] {
  const hero = pickHero(records);
  if (!hero) return [];
  return [hero, ...records.filter((r) => r.id !== hero.id).sort(byRecency)];
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderWidth: hairline,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
