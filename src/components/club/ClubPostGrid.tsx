import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ApiError } from '@/api/client';
import { postApi } from '@/api/endpoints';
import { clubPostsKey, flattenPosts } from '@/api/postCache';
import type { Post } from '@/api/types';
import { pageHeightFor } from '@/components/note';
import { NoteThumb } from '@/components/post/NoteThumb';
import { isNotePost } from '@/components/post/postFormat';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { Button, EmptyState, Loading } from '@/components/ui';
import { layout, radius, serif, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';

const COLUMNS = 3;
const GAP = spacing.xs;
const PAGE_SIZE = 30;

/**
 * 모임 독후감 — 모임 홈 '독후감' 탭. 인스타 프로필처럼 3열 격자, 칸 하나가 글 하나(3:4).
 * 노트 독후감은 1쪽 썸네일 + 작성자 아바타, 글 독후감은 명조 제목과 발췌를 얹은 종이 칸.
 * 칸을 누르면 상세로, '새 독후감' 은 모임을 싣고 모드 고르기로 간다(끝난 모임엔 없다 — 서버도 409).
 */
export function ClubPostGrid({ clubId, ended }: { clubId: number; ended: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const posts = useInfiniteQuery({
    queryKey: clubPostsKey(clubId),
    queryFn: ({ pageParam }) => postApi.clubPosts(clubId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
    enabled: Number.isFinite(clubId),
  });
  const items = useMemo(() => flattenPosts(posts.data?.pages), [posts.data]);
  const total = posts.data?.pages[0]?.totalElements ?? items.length;
  const contentWidth = Math.min(width, layout.content.maxWidth);
  const cell = Math.floor((contentWidth - GAP * (COLUMNS - 1)) / COLUMNS);

  const write = () => router.push({ pathname: '/post/new', params: { clubId: String(clubId) } });

  if (posts.isLoading) return <Loading />;
  if (posts.isError && items.length === 0) {
    return (
      <EmptyState
        title="독후감을 불러오지 못했어요"
        description={posts.error instanceof ApiError ? posts.error.message : undefined}
        action={<Button label="다시 시도" variant="outline" onPress={() => posts.refetch()} />}
      />
    );
  }

  return (
    <FlatList
      data={items}
      key={COLUMNS}
      numColumns={COLUMNS}
      keyExtractor={(p) => String(p.id)}
      renderItem={({ item }) => (
        <ClubPostCell post={item} width={cell} onPress={() => router.push(`/post/${item.id}`)} />
      )}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      onEndReached={() => {
        if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View style={[styles.head, { borderBottomColor: colors.line }]}>
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>모임 독후감 · {total}편</Text>
          {!ended ? <Button label="새 독후감" size="sm" variant="ghost" onPress={write} /> : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="아직 모임 독후감이 없어요"
          description={ended ? '끝난 모임이라 새 독후감을 쓸 수 없어요.' : '함께 읽은 책의 생각을 글이나 노트로 남겨 보세요.'}
          action={ended ? undefined : <Button label="첫 독후감 쓰기" onPress={write} />}
        />
      }
      ListFooterComponent={posts.isFetchingNextPage ? <ActivityIndicator size="small" color={colors.accent} style={styles.more} /> : null}
      windowSize={5}
      initialNumToRender={9}
      showsVerticalScrollIndicator={false}
    />
  );
}

/** 격자 한 칸 — 노트면 1쪽 썸네일, 글이면 제목·발췌 종이. 왼쪽 위에 작성자 아바타. */
function ClubPostCell({ post, width, onPress }: { post: Post; width: number; onPress: () => void }) {
  const { colors } = useTheme();
  const height = pageHeightFor(width);
  const note = isNotePost(post);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${post.authorNickname}의 독후감 ${post.title}`}
      style={({ pressed }) => [styles.cell, { width, height }, pressed ? pressedStyle : null]}
    >
      {note ? (
        <NoteThumb post={post} width={width} />
      ) : (
        <View style={[styles.paper, { width, height, backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text numberOfLines={3} style={[styles.title, { color: colors.text }]}>{post.title}</Text>
          {post.excerpt.length > 0 ? (
            <Text numberOfLines={5} style={[styles.excerpt, { color: colors.textMuted }]}>{post.excerpt}</Text>
          ) : null}
        </View>
      )}
      <View style={styles.author} pointerEvents="none">
        <QuoteAvatar uri={post.authorAvatarUrl} nickname={post.authorNickname} size={20} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: spacing.xxl, gap: GAP },
  row: { gap: GAP },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: GAP,
    borderBottomWidth: hairline,
  },
  cell: { overflow: 'hidden', borderRadius: radius.sm },
  // 아바타 자리(왼쪽 위)만큼 위를 비우고 제목부터.
  paper: {
    borderWidth: hairline,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm + 24,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  title: { fontFamily: serif.bold, fontSize: 13, lineHeight: 18 },
  excerpt: { ...typeScale.caption, fontSize: 10, lineHeight: 14 },
  author: { position: 'absolute', left: spacing.xs, top: spacing.xs },
  more: { paddingVertical: spacing.md },
});
