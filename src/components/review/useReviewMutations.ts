import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';
import { reviewApi } from '@/api/endpoints';
import { invalidateReviewLists, reviewKey } from '@/api/reviewCache';
import type { Review } from '@/api/types';

/** 리뷰가 바뀌거나 사라지면 — 리뷰 목록과 그 책의 평점·리뷰 수를 다시 받는다. */
function refreshAfterChange(queryClient: QueryClient, bookId: number) {
  invalidateReviewLists(queryClient);
  queryClient.invalidateQueries({ queryKey: ['book', bookId] });
}

/**
 * 내 리뷰 고치기 — 도서 상세의 리뷰 조각과 리뷰 상세가 같이 쓴다.
 * 별을 모두 비우면 별점을 지운다(별점은 선택). 태그는 앱에서 다루지 않으니 있던 그대로 돌려보낸다.
 */
export function useUpdateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ review, rating, body }: { review: Review; rating: number; body: string }) =>
      reviewApi.update(review.id, {
        body: body.trim(),
        ...(rating > 0 ? { rating } : { removeRating: true }),
        tags: review.tags,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(reviewKey(updated.id), updated);
      refreshAfterChange(queryClient, updated.bookId);
    },
  });
}

/** 내 리뷰 삭제 — 두 번 누르기(useDeleteConfirm)는 부르는 쪽이 맡는다. */
export function useRemoveReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (review: Review) => reviewApi.remove(review.id),
    onSuccess: (_, review) => {
      refreshAfterChange(queryClient, review.bookId);
      queryClient.removeQueries({ queryKey: reviewKey(review.id), exact: true });
    },
  });
}

/** 실패 문구 — 서버가 준 말이 있으면 그대로, 없으면 할 일을 붙여서. */
export function reviewMutationError(
  mutation: { isError: boolean; isPending: boolean; error: unknown },
  fallback: string,
): string | null {
  if (!mutation.isError || mutation.isPending) return null;
  return mutation.error instanceof ApiError ? mutation.error.message : fallback;
}
