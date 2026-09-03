import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { quoteApi } from '@/api/endpoints';
import {
  bumpCommentPatch, invalidateQuoteLists, patchQuoteEverywhere, quoteCommentsKey, quoteKey,
} from '@/api/quoteCache';
import type { Page, QuoteComment } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { COMMENT_BODY_MAX, CommentBar } from '@/components/comment/CommentBar';
import { CommentRow } from '@/components/comment/CommentRow';
import { QuoteCard } from '@/components/quote/QuoteCard';
import { useAgreeQuote } from '@/components/quote/useAgreeQuote';
import { EmptyState } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 댓글 한 페이지 — 오래된 순이라 다음 페이지가 더 새 댓글이다. */
const PAGE_SIZE = 30;
/** 상세 카드는 살짝만 기울인다 — 읽는 화면이라 광장보다 얌전하게. */
const CARD_TILT = -0.6;

/** 삭제 재확인 대상 — 밑줄 자체이거나 댓글 하나. */
type DeleteTarget = { kind: 'quote' } | { kind: 'comment'; id: number };

/** 로컬에 덧붙인 댓글이 다음 페이지에 다시 올 수 있어 id 로 걸러낸다. */
function dedupeComments(pages: Page<QuoteComment>[] | undefined): QuoteComment[] {
  const seen = new Set<number>();
  const items: QuoteComment[] = [];
  for (const page of pages ?? []) {
    for (const item of page.content ?? []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

/**
 * 밑줄 상세(D1) — 광장에서 본 카드가 그대로 위에 오고, 아래로 댓글이 붙는다.
 * 입력 바는 화면 아래 고정. 광장 카드·도서 상세 밑줄 조각에서 들어온다.
 */
export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quoteId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const pressAgree = useAgreeQuote();

  const quote = useQuery({
    queryKey: quoteKey(quoteId),
    queryFn: () => quoteApi.get(quoteId),
    enabled: Number.isFinite(quoteId),
  });

  const comments = useInfiniteQuery({
    queryKey: quoteCommentsKey(quoteId),
    queryFn: ({ pageParam }) => quoteApi.comments(quoteId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
    enabled: Number.isFinite(quoteId),
  });
  const items = dedupeComments(comments.data?.pages);

  // 삭제 재확인 — 밑줄과 댓글이 같은 타이머를 나눠 쓴다(한 번에 하나만 확인 상태). 3초·언마운트 정리는 공용 훅.
  const { confirm, arm, disarm } = useDeleteConfirm<DeleteTarget>();

  const [removeError, setRemoveError] = useState<string | null>(null);
  const removeQuote = useMutation({
    mutationFn: () => quoteApi.remove(quoteId),
    onMutate: () => setRemoveError(null),
    onSuccess: () => {
      invalidateQuoteLists(queryClient);
      queryClient.removeQueries({ queryKey: quoteKey(quoteId) });
      if (router.canGoBack()) router.back();
      else router.replace('/plaza');
    },
    onError: (error) => {
      setRemoveError(error instanceof ApiError ? error.message : '삭제하지 못했어요 · 다시 시도');
    },
  });
  const pressDeleteQuote = () => {
    if (confirm?.kind === 'quote') {
      disarm();
      removeQuote.mutate();
      return;
    }
    arm({ kind: 'quote' });
  };

  const [commentError, setCommentError] = useState<{ id: number; message: string } | null>(null);
  const removeComment = useMutation({
    mutationFn: (commentId: number) => quoteApi.removeComment(quoteId, commentId),
    onMutate: () => setCommentError(null),
    onSuccess: (_, commentId) => {
      // 무효화 대신 캐시에서 직접 지운다 — 지운 댓글이 오래된 순 페이지 어딘가에 있을 수 있어 모든 페이지를 훑는다.
      queryClient.setQueryData<InfiniteData<Page<QuoteComment>>>(quoteCommentsKey(quoteId), (old) =>
        old
          ? { ...old, pages: old.pages.map((p) => ({ ...p, content: (p.content ?? []).filter((c) => c.id !== commentId) })) }
          : old,
      );
      patchQuoteEverywhere(queryClient, quoteId, bumpCommentPatch(-1));
    },
    onError: (error, commentId) => {
      setCommentError({
        id: commentId,
        message: error instanceof ApiError ? error.message : '삭제하지 못했어요 · 다시 시도',
      });
    },
  });
  const pressDeleteComment = (commentId: number) => {
    if (confirm?.kind === 'comment' && confirm.id === commentId) {
      disarm();
      removeComment.mutate(commentId);
      return;
    }
    arm({ kind: 'comment', id: commentId });
  };

  const header = quote.data ? (
    <View style={styles.headerWrap}>
      <QuoteCard
        tilt={CARD_TILT}
        authorNickname={quote.data.authorNickname}
        authorAvatarUrl={quote.data.authorAvatarUrl}
        bookTitle={quote.data.bookTitle}
        page={quote.data.page}
        content={quote.data.content}
        agreeCount={quote.data.agreeCount}
        agreedByMe={quote.data.agreedByMe}
        commentCount={quote.data.commentCount}
        mine={quote.data.mine}
        confirming={confirm?.kind === 'quote'}
        error={removeError}
        onAgree={() => pressAgree(quoteId)}
        onDelete={quote.data.mine ? pressDeleteQuote : undefined}
        onOpenBook={() => router.push(`/book/${quote.data!.bookId}`)}
      />
      <View style={styles.commentsHead}>
        <Text style={[styles.commentsTitle, { color: colors.text }]}>댓글</Text>
        {comments.isError ? (
          <Pressable onPress={() => comments.refetch()} hitSlop={8} accessibilityRole="button"
            accessibilityLabel="댓글 다시 불러오기">
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>불러오지 못했어요 · 다시 시도</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  ) : null;

  const empty = !Number.isFinite(quoteId) ? (
    <EmptyState
      title="밑줄을 불러오지 못했습니다"
      description="지워졌거나 없는 밑줄입니다."
    />
  ) : quote.isLoading ? (
    <View style={[styles.skeleton, { backgroundColor: colors.surface }]} />
  ) : quote.isError ? (
    <EmptyState
      title="밑줄을 불러오지 못했습니다"
      description={quote.error instanceof ApiError && quote.error.status === 404
        ? '지워졌거나 없는 밑줄입니다.'
        : '잠시 후 다시 시도해 주세요.'}
    />
  ) : comments.isLoading ? (
    <View style={styles.footer}>
      <ActivityIndicator size="small" color={colors.accent} />
    </View>
  ) : comments.isError ? null : (
    <Text style={[typeScale.caption, styles.emptyComments, { color: colors.textFaint }]}>
      아직 덧붙인 말이 없어요. 첫 마디를 남겨보세요.
    </Text>
  );

  return (
    <PaperScreen>
      <SubHeader category="밑줄" />
      {/* 오프셋 없음 — 헤더리스라 KAV 의 frame.y 가 이미 SubHeader 를 포함한다(토론 화면과 같은 이유). */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <CommentRow
              nickname={item.authorNickname}
              avatarUrl={item.authorAvatarUrl}
              body={item.body}
              createdAt={item.createdAt}
              mine={item.mine}
              confirming={confirm?.kind === 'comment' && confirm.id === item.id}
              error={commentError?.id === item.id ? commentError.message : null}
              onDelete={() => pressDeleteComment(item.id)}
            />
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
        {quote.data ? <CommentComposer quoteId={quoteId} /> : null}
      </KeyboardAvoidingView>
    </PaperScreen>
  );
}

/** 하단 입력 바의 상태 — 본문·뮤테이션·캐시 패치는 여기, 그리기는 공용 CommentBar(제어형). */
function CommentComposer({ quoteId }: { quoteId: number }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= COMMENT_BODY_MAX;

  const create = useMutation({
    mutationFn: () => quoteApi.addComment(quoteId, { body: trimmed }),
    onSuccess: (created) => {
      setBody('');
      // 오래된 순이라 새 댓글은 마지막 페이지 끝에 붙는다 — invalidate 는 이미 받아 둔 페이지만 다시 받아 소용없다.
      queryClient.setQueryData<InfiniteData<Page<QuoteComment>>>(quoteCommentsKey(quoteId), (old) => {
        if (!old) {
          // 댓글 캐시가 없는 상태(예: 에러 상태)로는 붙일 페이지가 없다 — 목록을 다시 받아 오게 한다.
          queryClient.invalidateQueries({ queryKey: quoteCommentsKey(quoteId) });
          return old;
        }
        const pages = old.pages.slice();
        const lastIndex = pages.length - 1;
        pages[lastIndex] = { ...pages[lastIndex], content: [...(pages[lastIndex].content ?? []), created] };
        return { ...old, pages };
      });
      patchQuoteEverywhere(queryClient, quoteId, bumpCommentPatch(1));
    },
  });

  const errorMessage = create.isError && !create.isPending
    ? create.error instanceof ApiError ? create.error.message : '남기지 못했어요 · 다시 시도'
    : null;

  return (
    <CommentBar
      value={body}
      onChange={setBody}
      placeholder="이 문장에 덧붙이기…"
      canSubmit={canSubmit}
      pending={create.isPending}
      error={errorMessage}
      onSubmit={() => create.mutate()}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  headerWrap: { gap: spacing.lg, marginBottom: spacing.xs },
  commentsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  commentsTitle: { ...typeScale.titleSerif, fontSize: 15, lineHeight: 20 },
  skeleton: { height: 160, borderRadius: radius.md },
  emptyComments: { paddingVertical: spacing.md },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  more: { paddingVertical: spacing.md, alignItems: 'center' },
});
