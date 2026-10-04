import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { plazaApi } from '@/api/endpoints';
import type { PlazaItem } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { NAV_CLEARANCE, PaperScreen, TiltCover } from '@/components/collage';
import { PostFeed } from '@/components/post/PostFeed';
import { Card, EmptyState, formatRelative, linkLabel } from '@/components/ui';
import { TourTarget } from '@/components/tour/TourTarget';
import { SwipeableTabs } from '@/components/SwipeableTabs';
import { CapsuleTabs } from '@/components/CapsuleTabs';
import { useAuth } from '@/store/auth';
import { hairline, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

/** 한 번에 받아오는 피드 건수 — 카드가 커서 한 화면에 서너 장만 들어온다. */
const PAGE_SIZE = 10;
/** 카드 교차 회전(도) — 붙여 둔 티를 내되 읽기를 방해하지 않을 만큼만. */
const CARD_TILT = [-1.1, 0.8];
/** 완독 자랑 피드 캐시 키 — 광장 피드(type FINISH) 몫. 한 마디를 남기거나 지우면 ['plaza'] 로 무효화된다. */
const FINISH_FEED_KEY = ['plaza', 'FINISH'] as const;

/**
 * 광장 탭 — '독후감'은 독후감 피드(PostFeed), '완독 자랑'은 광장 피드의 FINISH 다.
 * 둘은 API·캐시가 달라 탭마다 제 목록을 그린다.
 */
type PlazaTab = 'POST' | 'FINISH';
const PLAZA_TABS: readonly PlazaTab[] = ['POST', 'FINISH'];

/**
 * 구역 3. 광장 — 다른 독자들의 독후감과 완독 자랑이 모이는 곳 (시안 2d).
 * 클럽은 상단 구역 탭으로 올라가 여기엔 없다.
 */
export default function PlazaScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const myId = useAuth((s) => s.user?.id);

  // 광장에 들어오면 독후감이 먼저 보인다 — 독후감은 여기가 입구다.
  const [tab, setTab] = useState<PlazaTab>('POST');

  const feed = useInfiniteQuery({
    queryKey: FINISH_FEED_KEY,
    queryFn: ({ pageParam }) => plazaApi.feed('FINISH', pageParam, PAGE_SIZE),
    initialPageParam: 0,
    // 독후감 탭은 PostFeed 가 제 피드를 받는다 — 여기서 광장 피드를 또 부르지 않는다.
    enabled: tab === 'FINISH',
    // 서버가 page 를 생략해도 이미 받은 페이지 수로 다음 번호를 셀 수 있다.
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  // 렌더마다 새 배열을 만들면 FlatList 가 매번 데이터가 바뀐 줄 안다 — 캐시가 바뀔 때만 새로 만든다.
  const items = useMemo(
    () => feed.data?.pages.flatMap((p) => p.content ?? []) ?? [],
    [feed.data],
  );

  const header = (
    <View style={styles.header}>
      <TourTarget id="plaza-actions" style={styles.chipRow}>
        {/* 다른 구역 상단 탭과 같은 캡슐 탭 — 독후감 · 완독 자랑 순. */}
        <CapsuleTabs
          items={[
            { value: 'POST', label: '독후감' },
            { value: 'FINISH', label: '완독 자랑' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {/* 쓰기는 독후감 탭에만 — 완독 자랑은 읽기 기록에서 자동으로 오른다.
            독후감은 길게 쓰는 글이라 접히는 패널이 아니라 제 화면으로 보낸다. */}
        {tab === 'POST' ? (
          <Pressable
            onPress={() => router.push('/post/new')}
            accessibilityRole="button"
            accessibilityLabel="독후감 쓰기"
            style={({ pressed }) => [styles.composeButton, { borderColor: colors.accent }, pressed && pressedStyle]}
          >
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>+ 독후감</Text>
          </Pressable>
        ) : null}
      </TourTarget>
    </View>
  );

  return (
    <PaperScreen>
      <SwipeableTabs values={PLAZA_TABS} value={tab} onChange={setTab}>
        {tab === 'POST' ? (
          <PostFeed ListHeaderComponent={header} />
        ) : (
          <FlatList
          data={items}
          keyExtractor={itemKey}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
          }}
          // 당겨서 새로고침 — 독후감 목록(PostList)과 같은 규칙. 방금 끝낸 책도 여기서 바로 올라온다.
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => feed.refetch()}
          renderItem={({ item, index }) => (
            <FinishCard
              item={item}
              index={index}
              mine={myId != null && item.authorId === myId}
              onOpenBook={() => router.push(`/book/${item.bookId}`)}
            />
          )}
          ListEmptyComponent={
            feed.isLoading ? (
              <View style={styles.skeletonList}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.skeleton, { backgroundColor: colors.surface }]} />
                ))}
              </View>
            ) : feed.isError ? (
              <EmptyState
                title="광장을 불러오지 못했습니다"
                description="잠시 후 다시 시도해 주세요."
                action={(
                  <Pressable
                    onPress={() => feed.refetch()}
                    accessibilityRole="button"
                    accessibilityLabel="다시 시도"
                    style={styles.retry}
                  >
                    <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('다시 시도', 'action')}</Text>
                  </Pressable>
                )}
              />
            ) : (
              <EmptyState illustration title="아직 완독 자랑이 없습니다" description="한 권을 끝내면 여기에 걸립니다." />
            )
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
          }
          />
        )}
      </SwipeableTabs>
    </PaperScreen>
  );
}

/** 완독 자랑 항목에는 id 가 없다 — 사람·책·시각 조합으로 가른다. */
function itemKey(item: PlazaItem): string {
  return `f${item.authorId}-${item.bookId}-${item.occurredAt}`;
}

/**
 * 완독 자랑 카드 한 장 — 작성자 줄 + 표지 행, 그리고 그 회차를 덮으며 남긴 한 마디(있을 때만).
 * 교차 회전을 쓴다.
 */
function FinishCard({ item, index, mine, onOpenBook }: {
  item: PlazaItem;
  index: number;
  mine: boolean;
  onOpenBook: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const tilt = CARD_TILT[index % CARD_TILT.length];

  return (
    <Card style={{ ...styles.card, transform: [{ rotate: `${tilt}deg` }] }}>
      {/* 작성자 줄을 누르면 그 사람의 마이페이지로 — 팔로우는 거기서 한다. */}
      <Pressable
        onPress={() => router.push(`/user/${item.authorId}`)}
        disabled={mine}
        accessibilityRole={mine ? undefined : 'button'}
        accessibilityLabel={mine ? undefined : `${item.authorNickname} 프로필 열기`}
        style={({ pressed }) => [styles.authorRow, pressed && pressedStyle]}
      >
        <Avatar uri={item.authorAvatarUrl} nickname={item.authorNickname} />
        <View style={styles.authorText}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
            {item.authorNickname}
          </Text>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.where, { color: colors.textFaint }]}>
            {item.bookTitle}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onOpenBook} accessibilityRole="button" accessibilityLabel={`${item.bookTitle} 상세`} style={styles.finishRow}>
        <TiltCover uri={item.bookCoverUrl} title={item.bookTitle} width={44} entering={false} />
        <View style={styles.finishText}>
          <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: colors.text }]}>
            {item.bookTitle}
          </Text>
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>
            완독 · {formatRelative(item.occurredAt)}
          </Text>
        </View>
      </Pressable>
      {/* 한 마디 — 도서 상세 '독자들의 한 마디'와 같은 따옴표 친 부리 한 줄. 리뷰는 붙이지 않는다(사용자 결정). */}
      {item.remark ? (
        <Text style={[styles.remark, { color: colors.text }]}>“{item.remark}”</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: NAV_CLEARANCE, gap: spacing.lg },
  header: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  // 탭과 쓰기 버튼은 한 줄 — 탭(가로 ScrollView)이 남는 폭을 채워 버튼은 오른쪽 끝에 붙는다.
  // 서로 다른 동작이라 오터치를 막게 sm 이상 띄운다.
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  composeButton: {
    flexShrink: 0,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: hairline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },

  card: { marginHorizontal: spacing.lg, gap: spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  authorText: { flex: 1 },
  // 작성자 행 조판은 홈 '오늘의 글'(ScrapAuthor)과 같다 — 아바타 AVATAR_SIZE, 닉네임 15/20, 메타 10/14.
  nickname: { lineHeight: 20 },
  where: { fontSize: 10, letterSpacing: 0.4, lineHeight: 14, marginTop: 2 },
  finishRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  finishText: { flex: 1, gap: spacing.xs },
  remark: { fontFamily: serif.regular, fontSize: 16, lineHeight: 26 },

  skeletonList: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  skeleton: { height: 128, borderRadius: radius.md },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  // 빈 상태 액션 — 웹은 hitSlop 을 무시하므로 여백으로 36px 상자를 만든다.
  retry: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md },
});
