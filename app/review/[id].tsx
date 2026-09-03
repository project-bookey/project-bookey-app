import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, reviewApi } from '@/api/endpoints';
import { reviewKey } from '@/api/reviewCache';
import { PaperScreen, SubHeader } from '@/components/collage';
import { CommentThread } from '@/components/comments';
import { ReviewCard } from '@/components/review/ReviewCard';
import { useReviewCommentAdapter } from '@/components/review/useReviewCommentAdapter';
import { EmptyState } from '@/components/ui';
import { radius, useTheme } from '@/theme';

/** 상세 카드는 살짝만 기울인다 — 읽는 화면이라 얌전하게(밑줄 상세와 같은 값). */
const CARD_TILT = -0.6;

/**
 * 리뷰 상세 — 도서 상세의 리뷰 조각에서 들어온다. 조각에서 잘린 전문이 카드로 펴지고,
 * 아래로 댓글과 답글이 붙는다. 목록·입력·답글은 공용 스레드가 통째로 맡는다.
 */
export default function ReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reviewId = Number(id);
  const router = useRouter();
  const { colors } = useTheme();
  const adapter = useReviewCommentAdapter(reviewId);

  const review = useQuery({
    queryKey: reviewKey(reviewId),
    queryFn: () => reviewApi.get(reviewId),
    enabled: Number.isFinite(reviewId),
  });

  // 리뷰 응답에는 책 제목이 없다 — 도서 상세와 같은 키로 받아 캐시를 나눠 쓴다.
  const bookId = review.data?.bookId;
  const book = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => bookApi.detail(bookId!),
    enabled: bookId != null,
  });

  const header = review.data ? (
    <ReviewCard
      tilt={CARD_TILT}
      authorNickname={review.data.authorNickname}
      rating={review.data.rating}
      verificationLevel={review.data.verificationLevel}
      body={review.data.body}
      tags={review.data.tags}
      commentCount={review.data.commentCount}
      createdAt={review.data.createdAt}
      bookTitle={book.data?.book.title}
      onOpenBook={() => router.push(`/book/${review.data!.bookId}`)}
    />
  ) : null;

  // 리뷰를 아직 못 받았을 때만 목록 자리를 대신한다 — 받고 나면 null 을 넘겨 스레드가 자기 빈 문구를 쓴다.
  const placeholder = !Number.isFinite(reviewId) ? (
    <EmptyState
      title="리뷰를 불러오지 못했습니다"
      description="지워졌거나 없는 리뷰입니다."
    />
  ) : review.isLoading ? (
    <View style={[styles.skeleton, { backgroundColor: colors.surface }]} />
  ) : review.isError ? (
    <EmptyState
      title="리뷰를 불러오지 못했습니다"
      description={review.error instanceof ApiError && review.error.status === 404
        ? '지워졌거나 없는 리뷰입니다.'
        : '잠시 후 다시 시도해 주세요.'}
    />
  ) : null;

  return (
    <PaperScreen>
      <SubHeader category="리뷰" />
      <CommentThread
        adapter={adapter}
        header={header}
        title="댓글"
        placeholder={placeholder}
        showComposer={!!review.data}
        composerPlaceholder="이 리뷰에 덧붙이기…"
        emptyText="아직 덧붙인 말이 없어요. 첫 마디를 남겨보세요."
      />
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  skeleton: { height: 160, borderRadius: radius.md },
});
