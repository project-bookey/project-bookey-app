import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View,
} from 'react-native';

import { postApi } from '@/api/endpoints';
import type { Page, PostView } from '@/api/types';
import { PostcardComposer } from '@/components/social/PostcardComposer';
import { Card, EmptyState, formatRelative } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

const PAGE_SIZE = 10;
const FEED_KEY = ['posts', 'feed', 'HOT'] as const;

type FeedCache = InfiniteData<Page<PostView>>;

/**
 * 독후감 피드 (§14.1) — 알고리즘(HOT)이 고른 독후감이 흐른다.
 * 댓글 없음, 좋아요만. 작성자를 누르면 마이페이지로 — 다시 만날 방법은 엽서뿐이다.
 */
export function PostFeed({ header }: { header?: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  /** 엽서 컴포저가 열린 독후감 id — 한 번에 한 장. */
  const [composingFor, setComposingFor] = useState<number | null>(null);

  const feed = useInfiniteQuery({
    queryKey: FEED_KEY,
    queryFn: ({ pageParam }) => postApi.feed('HOT', pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  const items = useMemo(
    () => feed.data?.pages.flatMap((p) => p.content ?? []) ?? [],
    [feed.data],
  );

  /** 좋아요 토글 — 응답 값으로 캐시를 맞춘다. 광장 밑줄과 같은 이유로 무효화하지 않는다. */
  const liking = useRef(new Set<number>());
  const like = useMutation({
    mutationFn: (postId: number) => postApi.like(postId),
    onSuccess: (result, postId) => {
      queryClient.setQueryData<FeedCache>(FEED_KEY, (cache) => {
        if (!cache) return cache;
        return {
          ...cache,
          pages: cache.pages.map((page) => ({
            ...page,
            content: (page.content ?? []).map((post) => (post.id === postId
              ? { ...post, likedByMe: result.liked, likeCount: result.likeCount }
              : post)),
          })),
        };
      });
    },
    onSettled: (_r, _e, postId) => liking.current.delete(postId),
  });
  const pressLike = (postId: number) => {
    if (liking.current.has(postId)) return;
    liking.current.add(postId);
    like.mutate(postId);
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(post) => String(post.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header ? <>{header}</> : null}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      renderItem={({ item }) => (
        <View style={styles.cardWrap}>
          <Card>
            {/* 작성자 — 좌측 상단, 누르면 마이페이지로 (§14.1) */}
            <Pressable
              onPress={() => router.push(`/user/${item.authorId}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.authorNickname} 프로필 열기`}
              style={styles.authorRow}
            >
              {item.authorAvatarUrl ? (
                <Image source={{ uri: item.authorAvatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[typeScale.label, { color: colors.accent }]}>
                    {item.authorNickname.slice(0, 1)}
                  </Text>
                </View>
              )}
              <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
                {item.authorNickname}
              </Text>
              <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
                {formatRelative(item.publishedAt ?? item.createdAt)}
              </Text>
            </Pressable>

            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[typeScale.body, { color: colors.textMuted }]} numberOfLines={5}>
              {item.excerpt}
            </Text>

            {item.bookTitle ? (
              <View style={[styles.bookRow, { borderColor: colors.line }]}>
                {item.bookCoverUrl ? (
                  <Image source={{ uri: item.bookCoverUrl }} style={styles.bookCover} />
                ) : null}
                <Text style={[typeScale.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
                  『{item.bookTitle}』
                </Text>
              </View>
            ) : null}

            {/* 상호작용은 좋아요와 엽서뿐 — 댓글 없음 (§14.1) */}
            <View style={[styles.footRow, { borderTopColor: colors.line }]}>
              <Pressable
                onPress={() => pressLike(item.id)}
                accessibilityRole="button"
                accessibilityLabel={item.likedByMe ? '좋아요 취소' : '좋아요'}
                style={styles.footAction}
                hitSlop={8}
              >
                <Text style={[typeScale.monoLabel, {
                  color: item.likedByMe ? colors.accent : colors.textFaint,
                }]}>
                  ♥ {item.likeCount}
                </Text>
              </Pressable>
              {!item.mine ? (
                <Pressable
                  onPress={() => setComposingFor(composingFor === item.id ? null : item.id)}
                  accessibilityRole="button"
                  accessibilityLabel="엽서 보내기"
                  style={styles.footAction}
                  hitSlop={8}
                >
                  <Text style={[typeScale.monoLabel, { color: colors.accent }]}>✉ 엽서</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>

          {composingFor === item.id ? (
            <View style={{ marginTop: spacing.sm }}>
              <PostcardComposer
                toUserId={item.authorId}
                toNickname={item.authorNickname}
                postId={item.id}
                postTitle={item.title}
                onDone={() => setComposingFor(null)}
              />
            </View>
          ) : null}
        </View>
      )}
      ListEmptyComponent={
        feed.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : feed.isError ? (
          <EmptyState title="피드를 불러오지 못했습니다" description="잠시 후 다시 시도해 주세요." />
        ) : (
          <EmptyState
            title="아직 독후감이 없습니다"
            description="완독하고 첫 독후감을 공개해 보세요."
          />
        )
      }
      ListFooterComponent={
        feed.isFetchingNextPage ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: spacing.xxl, gap: spacing.md },
  cardWrap: {},
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  title: {
    fontFamily: serif.bold, fontSize: 18, lineHeight: 26,
    marginTop: spacing.md, marginBottom: spacing.xs,
  },
  bookRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: hairline, borderRadius: radius.md,
    padding: spacing.sm, marginTop: spacing.md,
  },
  bookCover: { width: 24, height: 34, borderRadius: 3 },
  footRow: {
    flexDirection: 'row', gap: spacing.lg,
    borderTopWidth: hairline, paddingTop: spacing.md, marginTop: spacing.md,
  },
  footAction: { paddingVertical: 2 },
  loading: { padding: spacing.xl, alignItems: 'center' },
});
