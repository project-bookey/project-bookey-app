import { useInfiniteQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { dedupeComments, repliesKey } from '@/api/commentCache';
import { spacing, typeScale, useTheme } from '@/theme';

import { CommentRow } from './CommentRow';
import { REPLY_PAGE_SIZE } from './types';
import type { CommentThreadAdapter } from './types';

/**
 * 한 댓글의 답글 목록 — 부모 줄이 펼쳐졌을 때만 그린다.
 *
 * 목록이 FlatList 안이라 여기서는 일반 View + map 으로 쌓는다(중첩 목록은 바깥 가상화를 깨뜨린다).
 * 답글은 한 댓글에 몇 줄 수준이라 그래도 무겁지 않고, 접었다 펴도 캐시가 남아 다시 받지 않는다.
 */
export function ReplyList({ adapter, parentId, confirmId, errorFor, onPressDelete }: {
  adapter: CommentThreadAdapter;
  parentId: number;
  /** 삭제 재확인 중인 줄 — 댓글·답글이 한 타이머를 나눠 쓴다. */
  confirmId: number | null;
  errorFor: (commentId: number) => string | null;
  onPressDelete: (commentId: number) => void;
}) {
  const { colors } = useTheme();

  const replies = useInfiniteQuery({
    queryKey: repliesKey(adapter.listKey, parentId),
    queryFn: ({ pageParam }) => adapter.replies(parentId, pageParam, REPLY_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });
  const items = dedupeComments(replies.data?.pages);

  if (replies.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      {items.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          confirming={confirmId === reply.id}
          error={errorFor(reply.id)}
          onDelete={() => onPressDelete(reply.id)}
        />
      ))}
      {replies.isFetchingNextPage ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : replies.hasNextPage ? (
        <Pressable onPress={() => replies.fetchNextPage()} hitSlop={8} accessibilityRole="button"
          accessibilityLabel="답글 더 보기" style={styles.more}>
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>답글 더 보기 →</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: spacing.sm, alignItems: 'flex-start' },
  more: { paddingVertical: spacing.xs, alignSelf: 'flex-start' },
});
