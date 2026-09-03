import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { postApi } from '@/api/endpoints';
import { flattenPosts, myPostsKey } from '@/api/postCache';
import { PaperScreen, SubHeader } from '@/components/collage';
import { PostCard } from '@/components/post/PostCard';
import { useLikePost } from '@/components/post/useLikePost';
import { Button, EmptyState, FootAction } from '@/components/ui';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받아오는 건수 — 내 글은 훑어 내리는 목록이라 광장 피드(10)보다 크게 잡는다. */
const PAGE_SIZE = 20;
/** 카드 교차 회전(도) — 광장 독후감 피드와 같은 값이라 화면을 옮겨도 결이 이어진다. */
const CARD_TILT = [-1.1, 0.8];

/**
 * 내 독후감 — 프로필 '내 독후감'의 '전부 보기'로 들어온다.
 *
 * 광장 피드와 달리 비공개·링크 글까지 전부 걸린다(서버 `GET /api/v1/posts` 는 내 글을
 * 공개 범위와 무관하게 내려준다). 그래서 카드의 공개 범위 태그를 켠다 — 여기서만 켜는 이유는
 * 남에게 보이는 목록에서는 어차피 공개 글뿐이기 때문이다.
 * 책으로 건너뛰는 길은 두지 않는다 — 이 목록에서 궁금한 것은 '내가 뭘 썼나'이지 책이 아니다.
 */
export default function MyPostsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  /** '좋아요' 낙관 토글 — 광장·상세와 같은 공용 훅(인플라이트 가드 포함). */
  const pressLike = useLikePost();

  const mine = useInfiniteQuery({
    queryKey: myPostsKey,
    queryFn: ({ pageParam }) => postApi.mine(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    // 서버가 page 를 생략해도 이미 받은 페이지 수로 다음 번호를 셀 수 있다.
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  // 렌더마다 새 배열을 만들면 FlatList 가 매번 데이터가 바뀐 줄 안다 — 캐시가 바뀔 때만 새로 만든다.
  const items = useMemo(() => flattenPosts(mine.data?.pages), [mine.data]);

  const writeAction = (
    <Pressable
      onPress={() => router.push('/post/new')}
      accessibilityRole="button"
      accessibilityLabel="독후감 쓰기"
      style={styles.write}
    >
      <Text style={[typeScale.monoLabel, { color: colors.accent }]}>+ 쓰기</Text>
    </Pressable>
  );

  return (
    <PaperScreen>
      <SubHeader category="내 독후감" right={writeAction} />

      <FlatList
        data={items}
        keyExtractor={(post) => String(post.id)}
        contentContainerStyle={styles.list}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (mine.hasNextPage && !mine.isFetchingNextPage) mine.fetchNextPage();
        }}
        refreshing={mine.isRefetching && !mine.isFetchingNextPage}
        onRefresh={() => mine.refetch()}
        renderItem={({ item, index }) => (
          <PostCard
            post={item}
            tilt={CARD_TILT[index % CARD_TILT.length]}
            showVisibility
            onOpen={() => router.push(`/post/${item.id}`)}
            onLike={() => pressLike(item.id)}
          />
        )}
        ListEmptyComponent={
          mine.isLoading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.skeleton, { backgroundColor: colors.surface }]} />
              ))}
            </View>
          ) : mine.isError ? (
            <EmptyState
              title="독후감을 불러오지 못했어요"
              description="잠시 후 다시 시도해 주세요."
              action={(
                <Pressable
                  onPress={() => mine.refetch()}
                  accessibilityRole="button"
                  accessibilityLabel="다시 시도"
                  style={styles.retry}
                >
                  <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
                </Pressable>
              )}
            />
          ) : (
            <EmptyState
              title="아직 독후감이 없습니다"
              description="첫 독후감을 남겨보세요."
              action={<Button label="첫 독후감 쓰기" onPress={() => router.push('/post/new')} />}
            />
          )
        }
        ListFooterComponent={
          mine.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : mine.isError && items.length > 0 ? (
            // 다음 쪽을 못 받아도 이미 깔아 둔 카드는 그대로 둔다 — 발치에 다시 시도만 놓는다.
            <View style={styles.footer}>
              <FootAction
                label="더 불러오지 못했어요 · 다시 시도"
                onPress={() => (mine.hasNextPage ? mine.fetchNextPage() : mine.refetch())}
                tone="accent"
                accessibilityLabel="독후감 더 불러오기"
              />
            </View>
          ) : null
        }
      />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    ...layout.content,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  // 헤더 우측 슬롯 — 웹은 hitSlop 을 무시하므로 여백으로 44px 상자를 만든다.
  write: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
  skeletonList: { gap: spacing.lg },
  skeleton: { height: 160, borderRadius: radius.md },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  // 빈 상태 액션 — 웹은 hitSlop 을 무시하므로 여백으로 36px 상자를 만든다.
  retry: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md },
});
