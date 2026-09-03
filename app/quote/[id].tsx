import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { quoteApi } from '@/api/endpoints';
import { invalidateQuoteLists, quoteKey } from '@/api/quoteCache';
import { PaperScreen, SubHeader } from '@/components/collage';
import { CommentThread } from '@/components/comments';
import { QuoteCard } from '@/components/quote/QuoteCard';
import { useAgreeQuote } from '@/components/quote/useAgreeQuote';
import { useQuoteCommentAdapter } from '@/components/quote/useQuoteCommentAdapter';
import { EmptyState } from '@/components/ui';
import { radius, useTheme } from '@/theme';

/** 삭제 재확인이 살아 있는 시간(ms). 광장과 같은 값. */
const DELETE_CONFIRM_MS = 3000;
/** 상세 카드는 살짝만 기울인다 — 읽는 화면이라 광장보다 얌전하게. */
const CARD_TILT = -0.6;

/**
 * 밑줄 상세(D1) — 광장에서 본 카드가 그대로 위에 오고, 아래로 댓글이 붙는다.
 * 입력 바는 화면 아래 고정. 광장 카드·도서 상세 밑줄 조각에서 들어온다.
 *
 * 목록·입력·답글은 공용 스레드(CommentThread)가 통째로 맡는다. 이 화면에 남는 일은
 * 밑줄 한 건을 받아 카드로 세우고, 나도 그럼·삭제를 처리하는 것뿐이다.
 */
export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quoteId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const pressAgree = useAgreeQuote();
  const adapter = useQuoteCommentAdapter(quoteId);

  const quote = useQuery({
    queryKey: quoteKey(quoteId),
    queryFn: () => quoteApi.get(quoteId),
    enabled: Number.isFinite(quoteId),
  });

  // 밑줄 삭제 재확인 — 밑줄 전용 타이머다.
  // (의도된 변경: 댓글 삭제는 스레드가 자기 타이머로 따로 확인한다. 예전처럼 하나를 나눠 쓰지 않아
  //  밑줄을 확인 상태로 둔 채 댓글 삭제를 눌러도 서로 풀리지 않는다.)
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);
  const disarm = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = null;
    setConfirming(false);
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
    if (confirming) {
      disarm();
      removeQuote.mutate();
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirming(true);
    confirmTimer.current = setTimeout(() => {
      confirmTimer.current = null;
      setConfirming(false);
    }, DELETE_CONFIRM_MS);
  };

  const header = quote.data ? (
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
      confirming={confirming}
      error={removeError}
      onAgree={() => pressAgree(quoteId)}
      onDelete={quote.data.mine ? pressDeleteQuote : undefined}
      onOpenBook={() => router.push(`/book/${quote.data!.bookId}`)}
    />
  ) : null;

  // 밑줄을 아직 못 받았을 때만 목록 자리를 대신한다 — 받고 나면 null 을 넘겨 스레드가 자기 빈 문구를 쓴다.
  const placeholder = !Number.isFinite(quoteId) ? (
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
  ) : null;

  return (
    <PaperScreen>
      <SubHeader category="밑줄" />
      <CommentThread
        adapter={adapter}
        header={header}
        title="댓글"
        placeholder={placeholder}
        showComposer={!!quote.data}
        composerPlaceholder="이 문장에 덧붙이기…"
        emptyText="아직 덧붙인 말이 없어요. 첫 마디를 남겨보세요."
      />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  skeleton: { height: 160, borderRadius: radius.md },
});
