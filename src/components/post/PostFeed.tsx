import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { postApi } from '@/api/endpoints';
import { postFeedKey } from '@/api/postCache';
import type { Post } from '@/api/types';
import { PostCard } from '@/components/post/PostCard';
import { useLikePost } from '@/components/post/useLikePost';
import { EmptyState } from '@/components/ui';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받아오는 독후감 건수 — 광장 피드와 같은 크기. */
const PAGE_SIZE = 10;
/** 카드 교차 회전(도) — 광장 밑줄·완독 카드와 같은 값이라 탭을 바꿔도 결이 이어진다. */
const CARD_TILT = [-1.1, 0.8];

/**
 * 독후감 무한 피드 — 광장 '독후감' 탭의 본문.
 *
 * 광장 피드(`/plaza/feed`)와는 다른 API·다른 캐시라 리스트를 따로 세운다. 탭을 바꿀 때
 * 헤더(칩 행·컴포저)는 그대로여야 하므로 광장이 만든 헤더를 그대로 받아 얹는다.
 */
export function PostFeed({ ListHeaderComponent }: { ListHeaderComponent: ReactElement }) {
  const router = useRouter();
  const { colors } = useTheme();
  /** '좋아요' 낙관 토글 — 인플라이트 가드까지 공용 훅이 맡는다(상세·책별 목록과 같은 규율). */
  const pressLike = useLikePost();

  const feed = useInfiniteQuery({
    queryKey: postFeedKey,
    queryFn: ({ pageParam }) => postApi.feed(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    // 서버가 page 를 생략해도 이미 받은 페이지 수로 다음 번호를 셀 수 있다.
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  // 렌더마다 새 배열을 만들면 FlatList 가 매번 데이터가 바뀐 줄 안다 — 캐시가 바뀔 때만 새로 만든다.
  // 페이지 사이에 새 글이 끼면 같은 글이 두 페이지에 걸쳐 오므로 id 로 한 번 거른다(키 충돌 방지).
  const items = useMemo(() => {
    const seen = new Set<number>();
    const list: Post[] = [];
    for (const post of feed.data?.pages.flatMap((p) => p.content ?? []) ?? []) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      list.push(post);
    }
    return list;
  }, [feed.data]);

  return (
    <FlatList
      data={items}
      keyExtractor={(post) => String(post.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={ListHeaderComponent}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      refreshing={feed.isRefetching && !feed.isFetchingNextPage}
      onRefresh={() => feed.refetch()}
      renderItem={({ item, index }) => (
        <View style={styles.cardWrap}>
          <PostCard
            post={item}
            tilt={CARD_TILT[index % CARD_TILT.length]}
            onOpen={() => router.push(`/post/${item.id}`)}
            onLike={() => pressLike(item.id)}
            onOpenBook={item.bookId != null ? () => router.push(`/book/${item.bookId}`) : undefined}
          />
        </View>
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
            title="독후감을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            action={(
              <Pressable onPress={() => feed.refetch()} accessibilityRole="button" accessibilityLabel="다시 시도">
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
              </Pressable>
            )}
          />
        ) : (
          <EmptyState title="아직 독후감이 없어요" description="첫 독후감을 남겨보세요." />
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
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: spacing.xxl, gap: spacing.lg },
  cardWrap: { marginHorizontal: spacing.lg },
  skeletonList: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  skeleton: { height: 160, borderRadius: radius.md },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
});
