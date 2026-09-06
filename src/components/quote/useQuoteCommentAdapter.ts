import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { quoteApi } from '@/api/endpoints';
import { bumpCommentPatch, patchQuoteEverywhere, quoteCommentsKey } from '@/api/quoteCache';
import type { CommentThreadAdapter } from '@/components/comments';

/**
 * 밑줄 댓글 어댑터 — 공용 스레드가 밑줄 API·캐시를 만나는 유일한 창구.
 *
 * useMemo 로 고정한다. 매 렌더 새 객체를 넘기면 스레드의 useInfiniteQuery 가 queryFn·키를
 * 계속 갈아치워 쓸데없이 다시 조회한다.
 */
export function useQuoteCommentAdapter(quoteId: number): CommentThreadAdapter {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      listKey: quoteCommentsKey(quoteId),
      enabled: Number.isFinite(quoteId),
      list: (page, size) => quoteApi.comments(quoteId, page, size),
      replies: (commentId, page, size) => quoteApi.replies(quoteId, commentId, page, size),
      create: (body, parentId) => quoteApi.addComment(quoteId, { body, parentId }),
      remove: (commentId) => quoteApi.removeComment(quoteId, commentId),
      onCountChange: (delta) => patchQuoteEverywhere(queryClient, quoteId, bumpCommentPatch(delta)),
    }),
    [queryClient, quoteId],
  );
}
