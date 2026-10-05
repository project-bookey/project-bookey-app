import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from '@/navigation';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { postApi } from '@/api/endpoints';
import { bookPostsKey, flattenPosts } from '@/api/postCache';
import { PostScrap } from '@/components/post/PostScrap';
import { Card, TextLink } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받는 독후감 수 — 섹션 안에 붙는 조각이라 적게. */
const PAGE_SIZE = 5;

/**
 * 도서 상세 리뷰 섹션의 '독후감' 탭 — 이 책에 달린 공개 독후감을 점선 메모 조각으로 늘어놓는다.
 * 조각을 누르면 독후감 상세로 간다. 쓰기는 섹션 제목줄의 `쓰기 →`(작성 화면)로 나가므로
 * 여기에는 인라인 폼이 없다 — 사진·마크다운까지 있는 긴 글이라 한 화면을 다 쓴다.
 */
export function BookPostsTab({ bookId }: { bookId: number }) {
  const router = useRouter();
  const { colors } = useTheme();

  const posts = useInfiniteQuery({
    queryKey: bookPostsKey(bookId),
    queryFn: ({ pageParam }) => postApi.byBook(bookId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    // 서버가 page 를 생략해도 이미 받은 페이지 수로 다음 번호를 셀 수 있다.
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
    enabled: Number.isFinite(bookId),
  });

  // 페이지 사이에 새 글이 끼면 같은 글이 두 번 오므로 id 로 거른다(공용 flattenPosts).
  const items = useMemo(() => flattenPosts(posts.data?.pages), [posts.data]);

  if (posts.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (posts.isError && items.length === 0) {
    return (
      <Card>
        <Text style={[typeScale.body, { color: colors.textMuted }]}>독후감을 불러오지 못했어요.</Text>
        <TextLink label="다시 시도" kind="action" onPress={() => posts.refetch()}
          accessibilityLabel="독후감 다시 불러오기" style={styles.retry} />
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <Text style={[typeScale.caption, { color: colors.textMuted }]}>
          아직 이 책의 독후감이 없어요. 첫 글을 남겨 보세요.
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((post, index) => (
        // 이 책의 글만 늘어놓으므로 조각 메타는 책 제목 대신 작성자·반응을 보여 준다(variant="book").
        <PostScrap key={post.id} post={post} variant="book" rotate={index % 2 === 0 ? -1 : 1}
          onPress={() => router.push(`/post/${post.id}`)} />
      ))}
      {posts.isFetchingNextPage ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : posts.isError ? (
        // 다음 쪽을 못 받아도 이미 펼쳐 둔 조각은 그대로 둔다 — '더 보기' 자리에 다시 시도만 놓는다.
        <TextLink label="불러오지 못했어요 · 다시 시도" kind="action"
          onPress={() => (posts.hasNextPage ? posts.fetchNextPage() : posts.refetch())}
          accessibilityLabel="독후감 다시 불러오기" style={styles.more} />
      ) : posts.hasNextPage ? (
        <TextLink label="독후감 더 보기" kind="action" onPress={() => posts.fetchNextPage()} style={styles.more} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  center: { paddingVertical: spacing.md, alignItems: 'center' },
  // 글자 링크(TextLink)는 hitSlop 으로 44pt 를 채운다 — '다시 시도'는 위 본문과 왼쪽 끝을 맞춘다.
  retry: { alignSelf: 'flex-start', marginTop: spacing.sm },
  more: { alignSelf: 'center', marginVertical: spacing.md },
});
