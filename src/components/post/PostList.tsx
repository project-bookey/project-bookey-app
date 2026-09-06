import { useRouter } from 'expo-router';
import type { ReactElement, ReactNode } from 'react';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { flattenPosts } from '@/api/postCache';
import type { Page, Post } from '@/api/types';
import { PostCard } from '@/components/post/PostCard';
import { useLikePost } from '@/components/post/useLikePost';
import { EmptyState, FootAction } from '@/components/ui';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 카드 교차 회전(도) — 광장 밑줄·완독 카드와 같은 값이라 화면을 옮겨도 결이 이어진다. */
const CARD_TILT = [-1.1, 0.8];

/**
 * PostList 가 쿼리에서 보는 몫 — `useInfiniteQuery(...)` 결과를 그대로 넘기면 맞는다.
 * 키·queryFn·페이지 크기는 화면이 갖고, 목록은 상태만 읽는다.
 */
export type PostListQuery = {
  data?: { pages: Page<Post>[] };
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  refetch: () => unknown;
  fetchNextPage: () => unknown;
};

/**
 * 독후감 무한 목록의 뼈대 — 광장 '독후감' 탭(PostFeed)과 '내 독후감'(app/post/mine.tsx)이
 * 나눠 쓴다. 스켈레톤 3장 · 오류 빈 상태 · 부분 실패 발치 재시도 · 무한 스크롤 · 당겨 새로고침이
 * 두 화면에 그대로 복사돼 있던 것을 한 곳으로 모았다.
 *
 * 쿼리는 화면이 소유하고(캐시 키가 다르다) 목록은 프리젠테이션만 맡는다.
 * 화면마다 다른 것은 프롭으로만 갈린다 — 헤더(광장의 칩 행), 공개 범위 태그(내 글에서만),
 * 책으로 건너뛰기(광장에서만), 빈 상태 문구·버튼, 오류 제목.
 *
 * 상단 여백은 헤더 유무로 갈린다 — 헤더가 있는 화면은 헤더가 제 여백을 갖고,
 * 없는 화면(SubHeader 바로 아래로 카드가 붙는다)은 목록이 숨 쉴 자리를 만든다.
 */
export function PostList({
  query,
  ListHeaderComponent,
  showVisibility,
  onOpenBook,
  emptyTitle,
  emptyDescription,
  emptyAction,
  errorTitle,
}: {
  query: PostListQuery;
  /** 목록 위에 얹을 헤더(광장 '독후감' 탭의 칩 행). 없으면 목록이 위 여백을 갖는다. */
  ListHeaderComponent?: ReactElement;
  /** 공개 범위 태그를 켤지 — 내 글 목록에서만 켠다(남에게 보이는 목록은 공개 글뿐이다). */
  showVisibility?: boolean;
  /** 카드에서 책으로 건너뛰는 길. 책 없는 글에는 저절로 걸리지 않는다. */
  onOpenBook?: (bookId: number) => void;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  errorTitle: string;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  /** '좋아요' 낙관 토글 — 인플라이트 가드까지 공용 훅이 맡는다(상세·책별 목록과 같은 규율). */
  const pressLike = useLikePost();

  // 렌더마다 새 배열을 만들면 FlatList 가 매번 데이터가 바뀐 줄 안다 — 캐시가 바뀔 때만 새로 만든다.
  const items = useMemo(() => flattenPosts(query.data?.pages), [query.data]);

  return (
    <FlatList
      data={items}
      keyExtractor={(post) => String(post.id)}
      contentContainerStyle={[styles.list, !ListHeaderComponent && styles.listTop]}
      ListHeaderComponent={ListHeaderComponent}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
      }}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => query.refetch()}
      renderItem={({ item, index }) => {
        const bookId = item.bookId;
        return (
          <View style={styles.cardWrap}>
            <PostCard
              post={item}
              tilt={CARD_TILT[index % CARD_TILT.length]}
              showVisibility={showVisibility}
              onOpen={() => router.push(`/post/${item.id}`)}
              onOpenAuthor={() => router.push(`/user/${item.authorId}`)}
              onLike={() => pressLike(item.id)}
              onOpenBook={onOpenBook && bookId != null ? () => onOpenBook(bookId) : undefined}
            />
          </View>
        );
      }}
      ListEmptyComponent={
        query.isLoading ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.skeleton, { backgroundColor: colors.surface }]} />
            ))}
          </View>
        ) : query.isError ? (
          <EmptyState
            title={errorTitle}
            description="잠시 후 다시 시도해 주세요."
            action={(
              <Pressable
                onPress={() => query.refetch()}
                accessibilityRole="button"
                accessibilityLabel="다시 시도"
                style={styles.retry}
              >
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
              </Pressable>
            )}
          />
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        )
      }
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : query.isError && items.length > 0 ? (
          // 다음 쪽을 못 받아도 이미 깔아 둔 카드는 그대로 둔다 — 발치에 다시 시도만 놓는다.
          <View style={styles.footer}>
            <FootAction
              label="더 불러오지 못했어요 · 다시 시도"
              onPress={() => (query.hasNextPage ? query.fetchNextPage() : query.refetch())}
              tone="accent"
              accessibilityLabel="독후감 더 불러오기"
            />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: spacing.xxl, gap: spacing.lg },
  // 헤더가 없는 화면은 SubHeader 바로 밑이라 첫 카드가 붙어 보인다 — 한 칸 띄운다.
  listTop: { paddingTop: spacing.md },
  cardWrap: { marginHorizontal: spacing.lg },
  skeletonList: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  skeleton: { height: 160, borderRadius: radius.md },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  // 빈 상태 액션 — 웹은 hitSlop 을 무시하므로 여백으로 36px 상자를 만든다.
  retry: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md },
});
