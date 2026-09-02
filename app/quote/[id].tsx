import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text,
  TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { quoteApi } from '@/api/endpoints';
import {
  bumpCommentPatch, invalidateQuoteLists, patchQuoteEverywhere, quoteCommentsKey, quoteKey,
} from '@/api/quoteCache';
import type { Page, QuoteComment } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { QuoteAvatar, QuoteCard } from '@/components/quote/QuoteCard';
import { useAgreeQuote } from '@/components/quote/useAgreeQuote';
import { EmptyState, formatRelative } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 댓글 한 페이지 — 오래된 순이라 다음 페이지가 더 새 댓글이다. */
const PAGE_SIZE = 30;
/** 댓글 길이 상한 — 서버 계약과 같은 값. */
const BODY_MAX = 300;
/** 삭제 재확인이 살아 있는 시간(ms). 광장과 같은 값. */
const DELETE_CONFIRM_MS = 3000;
/** 상세 카드는 살짝만 기울인다 — 읽는 화면이라 광장보다 얌전하게. */
const CARD_TILT = -0.6;

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

  // 삭제 재확인 — 밑줄과 댓글이 같은 타이머를 나눠 쓴다(한 번에 하나만 확인 상태).
  const [confirm, setConfirm] = useState<{ kind: 'quote' } | { kind: 'comment'; id: number } | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);
  const arm = (next: NonNullable<typeof confirm>) => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirm(next);
    confirmTimer.current = setTimeout(() => {
      confirmTimer.current = null;
      setConfirm(null);
    }, DELETE_CONFIRM_MS);
  };
  const disarm = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = null;
    setConfirm(null);
  };

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
              comment={item}
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

/** 댓글 한 줄 — 아바타 이니셜 · 닉네임 · 본문 · 상대 시각 · (본인) 삭제. */
function CommentRow({ comment, confirming, error, onDelete }: {
  comment: QuoteComment;
  confirming: boolean;
  error: string | null;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <QuoteAvatar uri={comment.authorAvatarUrl} nickname={comment.authorNickname} />
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
          {comment.authorNickname}
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{comment.body}</Text>
        <View style={styles.metaRow}>
          <Text style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>
            {formatRelative(comment.createdAt)}
          </Text>
          {comment.mine ? (
            <Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button"
              accessibilityLabel={confirming ? '삭제 확인' : '삭제'}>
              <Text style={[typeScale.monoLabel, styles.meta, {
                color: confirming ? colors.danger : colors.textFaint,
              }]}>
                {confirming ? '한 번 더' : '삭제'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {error ? <Text style={[typeScale.caption, { color: colors.warn }]}>{error}</Text> : null}
      </View>
    </View>
  );
}

/** 하단 고정 입력 바 — 비어 있거나 전송 중이면 '남기기'가 죽는다. */
function CommentComposer({ quoteId }: { quoteId: number }) {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [body, setBody] = useState('');
  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= BODY_MAX;

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
    <View style={[styles.bar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
      <View style={styles.barRow}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="이 문장에 덧붙이기…"
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={BODY_MAX}
          accessibilityLabel="댓글"
          style={[styles.input, {
            backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
          }]}
        />
        <Pressable
          onPress={() => create.mutate()}
          disabled={!canSubmit || create.isPending}
          accessibilityRole="button"
          accessibilityLabel={create.isPending ? '남기는 중' : '댓글 남기기'}
          accessibilityState={{ disabled: !canSubmit || create.isPending }}
          style={[styles.send, {
            backgroundColor: colors.accent,
            opacity: !canSubmit || create.isPending ? 0.35 : 1,
          }]}
        >
          <Text style={[typeScale.monoLabel, { color: colors.onAccent }]}>
            {create.isPending ? '남기는 중…' : '남기기'}
          </Text>
        </Pressable>
      </View>
      {errorMessage ? (
        <Text style={[typeScale.caption, styles.barError, { color: colors.warn }]}>{errorMessage}</Text>
      ) : null}
    </View>
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

  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowBody: { flex: 1, gap: 2 },
  nickname: { fontSize: 12 },
  body: { ...typeScale.body, fontSize: 13, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  meta: { fontSize: 9, letterSpacing: 0.4 },

  bar: { ...layout.content, borderTopWidth: hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: hairline,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typeScale.body,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  send: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 3 },
  barError: { marginTop: spacing.xs },
});
