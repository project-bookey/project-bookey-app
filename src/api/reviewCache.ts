import type { QueryClient } from '@tanstack/react-query';

import type { Page, Review } from '@/api/types';

/**
 * 리뷰 캐시 — 같은 리뷰가 두 곳에 산다.
 *
 * 도서 상세의 책별 리뷰 목록과 리뷰 상세. 댓글 수가 바뀌면 두 곳을 한 번에 손봐야
 * 화면끼리 어긋나지 않는다. 키와 패치를 여기 한 곳에 둔다(밑줄 캐시와 같은 규율).
 */
export const reviewKey = (reviewId: number) => ['review', reviewId] as const;
/** 리뷰 댓글 — reviewKey 의 접두사다. 리뷰 키를 취소·무효화할 때는 exact: true 를 붙여야 댓글까지 딸려가지 않는다. */
export const reviewCommentsKey = (reviewId: number) => ['review', reviewId, 'comments'] as const;
/** 책별 리뷰 목록 — bookQuotesKey(['quotes','book',id]) 와 같은 모양. ['book', id](도서 상세) 와 뿌리를 분리한다. */
export const bookReviewsKey = (bookId: number) => ['reviews', 'book', bookId] as const;

/** 두 캐시가 공통으로 가진 반응 필드 — 패치는 이것만 건드린다. */
export type ReviewReaction = { commentCount?: number };
export type ReviewPatch =
  | Partial<ReviewReaction>
  | ((current: ReviewReaction) => Partial<ReviewReaction>);

/**
 * 캐시에 실제로 담기는 리뷰 — 생성 타입에 commentCount 가 아직 없을 수 있어 느슨하게 교차한다.
 * 서버 타입이 들어오면 교차가 그대로 그 필드로 좁혀지므로 이 파일은 그대로 둔다.
 */
type CachedReview = Review & ReviewReaction;

/** 댓글 수를 delta 만큼 옮긴다(0 아래로는 안 내려간다). 답글까지 세는 수라 부모를 지우면 -(1 + 답글 수)로 들어온다. */
export function bumpReviewCommentPatch(delta: number) {
  return (current: ReviewReaction): Partial<ReviewReaction> => ({
    commentCount: Math.max(0, (current.commentCount ?? 0) + delta),
  });
}

function resolve(patch: ReviewPatch, current: ReviewReaction): Partial<ReviewReaction> {
  return typeof patch === 'function' ? patch(current) : patch;
}

/** 한 리뷰를 두 캐시(책별 목록 · 상세)에서 찾아 같은 패치를 적용한다. 없는 캐시는 건너뛴다. */
export function patchReviewEverywhere(queryClient: QueryClient, reviewId: number, patch: ReviewPatch) {
  const patchReview = (review: CachedReview): CachedReview =>
    review.id === reviewId ? { ...review, ...resolve(patch, review) } : review;

  queryClient.setQueriesData<Page<CachedReview>>({ queryKey: ['reviews', 'book'] }, (old) =>
    old ? { ...old, content: (old.content ?? []).map(patchReview) } : old,
  );
  queryClient.setQueryData<CachedReview>(reviewKey(reviewId), (old) => (old ? patchReview(old) : old));
}

/** 리뷰가 생기거나 지워졌을 때 — 목록 캐시를 전부 다시 받게 한다. */
export function invalidateReviewLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['reviews'] });
}
