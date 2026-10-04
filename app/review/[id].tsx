import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, reviewApi } from '@/api/endpoints';
import { invalidateReviewLists, reviewKey } from '@/api/reviewCache';
import type { Review } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { KeyboardScroll } from '@/components/keyboard';
import { ReviewCard } from '@/components/review/ReviewCard';
import { ReviewForm } from '@/components/review/ReviewForm';
import { EmptyState, linkLabel } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useAuth } from '@/store/auth';
import { radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 리뷰 상세 — 도서 상세의 리뷰 조각에서 들어온다. 댓글 기능은 막고 본문만 펼친다.
 * 내 리뷰면 발치의 '고치기'로 이 자리에서 쓰는 칸으로 바꾸고, '삭제'는 두 번 눌러 지운다.
 */
export default function ReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reviewId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const myId = useAuth((state) => state.user?.id);

  const review = useQuery({
    queryKey: reviewKey(reviewId),
    queryFn: () => reviewApi.get(reviewId),
    enabled: Number.isFinite(reviewId),
  });

  // 리뷰 응답에는 책 제목이 없다 — 도서 상세와 같은 키로 받아 캐시를 나눠 쓴다.
  const bookId = review.data?.bookId;
  // 리뷰가 오기 전엔 자리 키만 — 실제 요청은 enabled 가 막는다.
  const book = useQuery({
    queryKey: bookId != null ? ['book', bookId] : ['book', 'pending'],
    queryFn: () => bookApi.detail(bookId!),
    enabled: bookId != null,
  });

  const mine = review.data != null && review.data.authorId === myId;

  // 리뷰가 바뀌거나 사라지면 책의 평점·리뷰 수와 리뷰 목록도 다시 받는다.
  const refreshLists = () => {
    invalidateReviewLists(queryClient);
    if (bookId != null) queryClient.invalidateQueries({ queryKey: ['book', bookId] });
  };

  // 고치기 — 지금 리뷰로 칸을 채워 연다. 취소하면 고친 글은 버린다.
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const update = useMutation({
    mutationFn: (current: Review) => reviewApi.update(reviewId, {
      body: body.trim(),
      // 별을 모두 비우면 별점을 지운다 — 별점은 선택이다.
      ...(rating > 0 ? { rating } : { removeRating: true }),
      tags: current.tags,
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData(reviewKey(reviewId), updated);
      refreshLists();
      setEditing(false);
    },
  });
  const startEditing = (current: Review) => {
    setRating(current.rating ?? 0);
    setBody(current.body);
    update.reset();
    setEditing(true);
  };

  const { confirm, arm, disarm } = useDeleteConfirm<'review'>();
  const confirming = confirm === 'review';
  const remove = useMutation({
    mutationFn: () => reviewApi.remove(reviewId),
    onSuccess: () => {
      refreshLists();
      queryClient.removeQueries({ queryKey: reviewKey(reviewId), exact: true });
      // 딥링크로 바로 들어왔으면 돌아갈 곳이 없다 — 그 책 화면으로 간다(리뷰가 있어야 지울 수 있으니 bookId 는 있다).
      if (router.canGoBack()) router.back();
      else router.replace(`/book/${bookId}`);
    },
  });
  const pressDelete = () => {
    if (confirming) {
      disarm();
      remove.mutate();
      return;
    }
    arm('review');
  };

  const updateError = update.isError && !update.isPending
    ? update.error instanceof ApiError ? update.error.message : '저장하지 못했어요. 다시 시도해 주세요.'
    : null;
  const removeError = remove.isError && !remove.isPending
    ? remove.error instanceof ApiError ? remove.error.message : '삭제하지 못했어요. 다시 시도해 주세요.'
    : null;

  const article = review.data ? (
    editing ? (
      <ReviewForm
        nickname={review.data.authorNickname}
        rating={rating}
        onRating={setRating}
        body={body}
        onBody={setBody}
        submitLabel="저장"
        onSubmit={() => update.mutate(review.data!)}
        onCancel={() => setEditing(false)}
        pending={update.isPending}
        error={updateError}
      />
    ) : (
      <View style={styles.article}>
        <ReviewCard
          authorNickname={review.data.authorNickname}
          rating={review.data.rating}
          body={review.data.body}
          tags={review.data.tags}
          commentCount={review.data.commentCount}
          createdAt={review.data.createdAt}
          bookTitle={book.data?.book.title}
          authorFinished={review.data.authorFinished}
          onOpenBook={() => router.push(`/book/${review.data!.bookId}`)}
          onEdit={mine ? () => startEditing(review.data!) : undefined}
          onDelete={mine && !remove.isPending ? pressDelete : undefined}
          deleteConfirming={confirming}
        />
        {removeError ? <Text style={[typeScale.caption, { color: colors.danger }]}>{removeError}</Text> : null}
      </View>
    )
  ) : null;

  const placeholder = !Number.isFinite(reviewId) ? (
    <EmptyState
      title="리뷰를 불러오지 못했어요"
      description="지워졌거나 없는 리뷰예요."
    />
  ) : review.isLoading ? (
    <View style={[styles.skeleton, { backgroundColor: colors.surface }]} />
  ) : review.isError ? (
    review.error instanceof ApiError && review.error.status === 404 ? (
      <EmptyState
        title="리뷰를 불러오지 못했어요"
        description="지워졌거나 없는 리뷰예요."
      />
    ) : (
      <EmptyState
        title="리뷰를 불러오지 못했어요"
        description="잠시 후 다시 시도해 주세요."
        action={
          <Pressable onPress={() => review.refetch()} accessibilityRole="button" accessibilityLabel="다시 시도">
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('다시 시도', 'action')}</Text>
          </Pressable>
        }
      />
    )
  ) : null;

  return (
    <PaperScreen>
      <SubHeader category="리뷰" />
      {/* 고치는 칸을 누르면 '저장'까지 키보드 위로 올라온다. */}
      <KeyboardScroll contentContainerStyle={styles.screenBody}>
        {placeholder ?? article}
      </KeyboardScroll>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  screenBody: { padding: spacing.lg, paddingBottom: spacing.xxl },
  article: { gap: spacing.sm },
  skeleton: { height: 160, borderRadius: radius.md },
});
