import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { reviewApi } from '@/api/endpoints';
import { bumpReviewCommentPatch, patchReviewEverywhere, reviewCommentsKey } from '@/api/reviewCache';
import type { CommentThreadAdapter } from '@/components/comments';

/**
 * 리뷰 댓글 어댑터 — 공용 스레드가 리뷰 API·캐시를 만나는 유일한 창구(밑줄 어댑터와 같은 모양).
 *
 * useMemo 로 고정한다. 매 렌더 새 객체를 넘기면 스레드의 useInfiniteQuery 가 queryFn·키를
 * 계속 갈아치워 쓸데없이 다시 조회한다.
 */
export function useReviewCommentAdapter(reviewId: number): CommentThreadAdapter {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      listKey: reviewCommentsKey(reviewId),
      enabled: Number.isFinite(reviewId),
      list: (page, size) => reviewApi.comments(reviewId, page, size),
      replies: (commentId, page, size) => reviewApi.replies(reviewId, commentId, page, size),
      create: (body, parentId) => reviewApi.addComment(reviewId, { body, parentId }),
      remove: (commentId) => reviewApi.removeComment(reviewId, commentId),
      onCountChange: (delta) =>
        patchReviewEverywhere(queryClient, reviewId, bumpReviewCommentPatch(delta)),
    }),
    [queryClient, reviewId],
  );
}
