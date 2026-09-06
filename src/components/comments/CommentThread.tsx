import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text,
  TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import {
  appendComment, bumpReplyCount, dedupeComments, findComment, nextPageParam, removeComment, repliesKey,
} from '@/api/commentCache';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { layout, spacing, typeScale, useTheme } from '@/theme';

import { CommentRow } from './CommentRow';
import { ReplyList } from './ReplyList';
import { ThreadComposer } from './ThreadComposer';
import { BODY_MAX, PAGE_SIZE } from './types';
import type { CommentThreadAdapter, ReplyTarget, ThreadComment } from './types';

/**
 * 댓글 스레드 — 밑줄 상세와 리뷰 상세가 같이 쓰는 목록 + 입력 바.
 *
 * 화면은 위에 올릴 카드(header)와 어댑터만 넘기고, 상태·뮤테이션·캐시 손질은 전부 여기서 한다.
 * 답글은 서버 계약대로 한 단계까지다 — 접기 컨트롤은 최상위 줄만 가진다. '답글 달기'는 답글 줄에도
 * 붙지만, 답글의 답글도 같은 최상위 부모에 평평하게 달리고 본문 앞에 '@닉네임' 이 붙는다(인스타그램식).
 */
export function CommentThread({
  adapter, header, title = '댓글', placeholder, showComposer = true, composerPlaceholder, emptyText,
}: {
  adapter: CommentThreadAdapter;
  /** 목록 위에 올릴 카드 — 밑줄은 QuoteCard, 리뷰는 ReviewCard. */
  header?: ReactNode;
  title?: string;
  /** 대상을 아직 못 받았을 때 목록 자리에 대신 놓을 것(로딩 뼈대·안내). */
  placeholder?: ReactNode;
  showComposer?: boolean;
  composerPlaceholder: string;
  emptyText: string;
}) {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const composerRef = useRef<TextInput>(null);

  const comments = useInfiniteQuery({
    queryKey: adapter.listKey,
    queryFn: ({ pageParam }) => adapter.list(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    enabled: adapter.enabled,
  });
  const items = dedupeComments(comments.data?.pages);

  /** 펼친 부모 — 접었다 펴도 답글 캐시가 남아 다시 받지 않는다. */
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

  // 삭제 재확인 — 댓글과 답글이 한 타이머를 나눠 쓴다(한 번에 하나만 확인 상태). 3초·언마운트 정리는 공용 훅.
  const { confirm: confirmId, arm, disarm } = useDeleteConfirm<number>();

  const expand = (commentId: number) =>
    setExpanded((prev) => (prev.has(commentId) ? prev : new Set(prev).add(commentId)));
  const collapse = (commentId: number) =>
    setExpanded((prev) => {
      if (!prev.has(commentId)) return prev;
      const next = new Set(prev);
      next.delete(commentId);
      return next;
    });
  const toggleReplies = (commentId: number) =>
    (expanded.has(commentId) ? collapse : expand)(commentId);

  /**
   * 답글 달기 — 대상 부모를 미리 펼쳐 두고 입력에 커서를 준다(읽던 자리를 뺏지 않으려 스크롤은 하지 않는다).
   *
   * parent 가 있으면 target 은 답글이다 — 서버가 한 단계만 받으므로 부모는 그대로 두고(같은 묶음에 평평하게)
   * 본문 앞에 '@닉네임' 만 붙여 누구에게 하는 말인지 남긴다.
   */
  const startReply = (target: ThreadComment, parent?: ThreadComment) => {
    const parentId = parent?.id ?? target.id;
    setReplyTo({
      parentId,
      nickname: target.authorNickname,
      mention: parent ? `@${target.authorNickname}` : undefined,
    });
    expand(parentId);
    composerRef.current?.focus();
  };

  const submit = async (text: string) => {
    const parentId = replyTo?.parentId;
    // 답글의 답글이면 본문 앞에 '@닉네임' 을 붙여 보낸다 — 서버에는 그냥 같은 부모의 답글이다.
    const body = replyTo?.mention ? `${replyTo.mention} ${text}`.trim() : text;
    const created = await adapter.create(body, parentId);
    if (parentId == null) {
      // 최상위 — 캐시가 없으면(에러·미조회) 붙일 자리가 없어 목록을 다시 받게 한다.
      // exact: true — 답글 키가 목록 키를 접두사로 써서 그냥 두면 펼쳐 둔 답글까지 딸려 나간다.
      if (!appendComment(queryClient, adapter.listKey, created)) {
        queryClient.invalidateQueries({ queryKey: adapter.listKey, exact: true });
      }
      adapter.onCountChange(1);
      return created;
    }
    // 답글 — 답글 캐시가 없으면(첫 /replies 조회 전) 붙일 자리가 없으니 무효화해 둔다.
    // exact: true — repliesKey 아래로 더 매달린 키는 없지만 최상위 분기와 같은 규율을 지킨다.
    if (!appendComment(queryClient, repliesKey(adapter.listKey, parentId), created)) {
      queryClient.invalidateQueries({ queryKey: repliesKey(adapter.listKey, parentId), exact: true });
    }
    bumpReplyCount(queryClient, adapter.listKey, parentId, 1);
    expand(parentId);
    adapter.onCountChange(1);
    setReplyTo(null);
    return created;
  };

  // '@닉네임 ' 까지 합쳐 300자를 넘지 않게 — 멘션이 붙는 만큼 입력 상한을 미리 깎는다.
  const composerMax = replyTo?.mention ? BODY_MAX - (replyTo.mention.length + 1) : BODY_MAX;

  const remove = useMutation({
    mutationFn: ({ commentId }: { commentId: number; parentId?: number }) => adapter.remove(commentId),
    onMutate: () => setRowError(null),
    onSuccess: (_result, { commentId, parentId }) => {
      if (parentId == null) {
        // 부모를 지우면 답글도 서버에서 함께 지워진다 — 캐시에서 걷어내기 전에 몇 개였는지 세어 둔다.
        const replyCount = findComment(queryClient, adapter.listKey, commentId)?.replyCount ?? 0;
        removeComment(queryClient, adapter.listKey, commentId);
        queryClient.removeQueries({ queryKey: repliesKey(adapter.listKey, commentId) });
        collapse(commentId);
        setReplyTo((prev) => (prev?.parentId === commentId ? null : prev));
        adapter.onCountChange(-(1 + replyCount));
        return;
      }
      removeComment(queryClient, repliesKey(adapter.listKey, parentId), commentId);
      bumpReplyCount(queryClient, adapter.listKey, parentId, -1);
      adapter.onCountChange(-1);
      // 마지막 답글이 지워졌으면 접는다 — 펼친 채로 두면 빈 답글 영역만 남는다.
      if ((findComment(queryClient, adapter.listKey, parentId)?.replyCount ?? 0) === 0) {
        collapse(parentId);
      }
    },
    onError: (error, { commentId }) => {
      setRowError({
        id: commentId,
        message: error instanceof ApiError ? error.message : '삭제하지 못했어요 · 다시 시도',
      });
    },
  });

  /** 한 번 더 눌러야 지워진다 — 3초 안에 다시 누르지 않으면 확인이 풀린다. */
  const pressDelete = (commentId: number, parentId?: number) => {
    if (confirmId === commentId) {
      disarm();
      remove.mutate({ commentId, parentId });
      return;
    }
    arm(commentId);
  };

  // 대상을 아직 못 받은 화면은 placeholder 를 목록 헤더에 바로 얹는다 — ListEmptyComponent 로만 두면
  // 댓글 목록 자체는 이미 받아 온(항목이 있는) 경우 아예 그려지지 않아 안내가 사라지기 때문이다.
  // placeholder 가 있을 땐 제목줄(과 댓글 자체 에러 안내)도 내린다 — 대상이 없으면 댓글 얘기를 할 자리가 아니다.
  const listHeader = (
    <View style={styles.headerWrap}>
      {header}
      {placeholder ?? (
        <View style={styles.commentsHead}>
          <Text style={[styles.commentsTitle, { color: colors.text }]}>{title}</Text>
          {comments.isError ? (
            <Pressable onPress={() => comments.refetch()} hitSlop={8} accessibilityRole="button"
              accessibilityLabel="댓글 다시 불러오기">
              <Text style={[typeScale.monoLabel, { color: colors.accent }]}>불러오지 못했어요 · 다시 시도</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );

  // placeholder 가 떠 있는 동안은 목록 자체의 로딩·에러·빈 문구를 겹쳐 보여줄 필요가 없다.
  const empty = placeholder ? null : (
    <View>
      {comments.isLoading ? (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : comments.isError ? null : (
        <Text style={[typeScale.caption, styles.emptyComments, { color: colors.textFaint }]}>
          {emptyText}
        </Text>
      )}
    </View>
  );

  return (
    /* 오프셋 없음 — 헤더리스라 KAV 의 frame.y 가 이미 SubHeader 를 포함한다(토론 화면과 같은 이유). */
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        renderItem={({ item }) => (
          <CommentRow
            comment={item}
            confirming={confirmId === item.id}
            error={rowError?.id === item.id ? rowError.message : null}
            expanded={expanded.has(item.id)}
            onToggleReplies={() => toggleReplies(item.id)}
            onPressReply={showComposer ? () => startReply(item) : undefined}
            onDelete={() => pressDelete(item.id)}
          >
            {expanded.has(item.id) ? (
              <ReplyList
                adapter={adapter}
                parentId={item.id}
                confirmId={confirmId}
                errorFor={(replyId) => (rowError?.id === replyId ? rowError.message : null)}
                onPressDelete={(replyId) => pressDelete(replyId, item.id)}
                onPressReply={showComposer ? (reply) => startReply(reply, item) : undefined}
              />
            ) : null}
          </CommentRow>
        )}
        ListFooterComponent={
          comments.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : comments.hasNextPage ? (
            <Pressable onPress={() => comments.fetchNextPage()} accessibilityRole="button"
              accessibilityLabel="댓글 더 보기" hitSlop={8} style={styles.more}>
              <Text style={[typeScale.monoLabel, { color: colors.accent }]}>댓글 더 보기 →</Text>
            </Pressable>
          ) : null
        }
      />
      {showComposer ? (
        <ThreadComposer
          ref={composerRef}
          placeholder={composerPlaceholder}
          replyTo={replyTo}
          maxLength={composerMax}
          onCancelReply={() => setReplyTo(null)}
          onSubmit={submit}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  headerWrap: { gap: spacing.lg, marginBottom: spacing.xs },
  commentsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  commentsTitle: { ...typeScale.titleSerif, fontSize: 15, lineHeight: 20 },
  emptyComments: { paddingVertical: spacing.md },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  more: { paddingVertical: spacing.md, alignItems: 'center' },
});
