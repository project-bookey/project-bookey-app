import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { bookApi, reviewApi } from '@/api/endpoints';
import { reviewKey } from '@/api/reviewCache';
import { PaperScreen, SubHeader } from '@/components/collage';
import { ReviewCard } from '@/components/review/ReviewCard';
import { EmptyState } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/theme';

/** 상세 카드는 살짝만 기울인다 — 읽는 화면이라 얌전하게(밑줄 상세와 같은 값). */
const CARD_TILT = -0.6;

/**
 * 리뷰 상세 — 도서 상세의 리뷰 조각에서 들어온다. 댓글 기능은 막고 본문만 펼친다.
 */
export default function ReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reviewId = Number(id);
  const router = useRouter();
  const { colors } = useTheme();

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

  const article = review.data ? (
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

  const placeholder = !Number.isFinite(reviewId) ? (
    <EmptyState
      title="리뷰를 불러오지 못했습니다"
      description="지워졌거나 없는 리뷰입니다."
    />
  ) : review.isLoading ? (
    <View style={[styles.skeleton, { backgroundColor: colors.surface }]} />
  ) : review.isError ? (
    review.error instanceof ApiError && review.error.status === 404 ? (
      <EmptyState
        title="리뷰를 불러오지 못했습니다"
        description="지워졌거나 없는 리뷰입니다."
      />
    ) : (
      <EmptyState
        title="리뷰를 불러오지 못했습니다"
        description="잠시 후 다시 시도해 주세요."
        action={
          <Pressable onPress={() => review.refetch()} accessibilityRole="button" accessibilityLabel="다시 시도">
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
          </Pressable>
        }
      />
    )
  ) : null;

  return (
    <PaperScreen>
      <SubHeader category="리뷰" />
      <ScrollView contentContainerStyle={styles.screenBody}>
        {placeholder ?? article}
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  screenBody: { padding: spacing.lg, paddingBottom: spacing.xxl },
  skeleton: { height: 160, borderRadius: radius.md },
});
