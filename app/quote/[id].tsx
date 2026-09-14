import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { quoteApi } from '@/api/endpoints';
import { invalidateQuoteLists, quoteKey } from '@/api/quoteCache';
import { PaperScreen, SubHeader } from '@/components/collage';
import { QuoteCard } from '@/components/quote/QuoteCard';
import { useAgreeQuote } from '@/components/quote/useAgreeQuote';
import { PostcardComposer } from '@/components/social/PostcardComposer';
import { EmptyState, FootAction } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { radius, spacing, typeScale, useTheme } from '@/theme';

/** 상세 카드는 살짝만 기울인다 — 읽는 화면이라 광장보다 얌전하게. */
const CARD_TILT = -0.6;

/**
 * 밑줄 상세(D1) — 광장에서 본 카드가 그대로 위에 오고, 좋아요·엽서·삭제만 처리한다.
 */
export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quoteId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const pressAgree = useAgreeQuote();
  const [postcardOpen, setPostcardOpen] = useState(false);

  const quote = useQuery({
    queryKey: quoteKey(quoteId),
    queryFn: () => quoteApi.get(quoteId),
    enabled: Number.isFinite(quoteId),
  });

  // 밑줄 삭제 재확인 — 밑줄 전용 타이머다(3초·언마운트 정리는 공용 훅).
  // (의도된 변경: 댓글 삭제는 스레드가 자기 타이머로 따로 확인한다. 예전처럼 하나를 나눠 쓰지 않아
  //  밑줄을 확인 상태로 둔 채 댓글 삭제를 눌러도 서로 풀리지 않는다.)
  const { confirm, arm, disarm } = useDeleteConfirm<'quote'>();
  const confirming = confirm === 'quote';

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
    arm('quote');
  };

  const article = quote.data ? (
    <View style={styles.content}>
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
      {!quote.data.mine ? (
        <View style={styles.actions}>
          <FootAction
            label="엽서 보내기"
            onPress={() => setPostcardOpen((open) => !open)}
            tone="accent"
            accessibilityLabel={`${quote.data.authorNickname}에게 엽서 보내기`}
          />
        </View>
      ) : null}
      {postcardOpen ? (
        <PostcardComposer
          toUserId={quote.data.authorId}
          toNickname={quote.data.authorNickname}
          onDone={() => setPostcardOpen(false)}
        />
      ) : null}
    </View>
  ) : null;

  const placeholder = !Number.isFinite(quoteId) ? (
    <EmptyState
      title="밑줄을 불러오지 못했습니다"
      description="지워졌거나 없는 밑줄입니다."
    />
  ) : quote.isLoading ? (
    <View style={[styles.skeleton, { backgroundColor: colors.surface }]} />
  ) : quote.isError ? (
    quote.error instanceof ApiError && quote.error.status === 404 ? (
      <EmptyState
        title="밑줄을 불러오지 못했습니다"
        description="지워졌거나 없는 밑줄입니다."
      />
    ) : (
      <EmptyState
        title="밑줄을 불러오지 못했습니다"
        description="잠시 후 다시 시도해 주세요."
        action={
          <Pressable onPress={() => quote.refetch()} accessibilityRole="button" accessibilityLabel="다시 시도">
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
          </Pressable>
        }
      />
    )
  ) : null;

  return (
    <PaperScreen>
      <SubHeader category="밑줄" />
      <ScrollView contentContainerStyle={styles.screenBody}>
        {placeholder ?? article}
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  screenBody: { padding: spacing.lg, paddingBottom: spacing.xxl },
  content: { gap: spacing.lg },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  skeleton: { height: 160, borderRadius: radius.md },
});
