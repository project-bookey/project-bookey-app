import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { Page } from '@/api/types';
import type { ThreadComment } from '@/components/comments/types';

/**
 * 댓글 스레드 캐시 — 밑줄·리뷰가 함께 쓰는 도메인 무관 조작.
 *
 * 스레드는 무효화 대신 캐시를 직접 손본다. 오래된 순 무한 목록이라 무효화하면 이미 받아 둔
 * 페이지를 전부 다시 받으면서도 방금 쓴 댓글은 다음 페이지에 있어 안 보이기 때문이다.
 * 목록 키는 도메인마다 다르므로(밑줄·리뷰) 키를 인자로 받는다.
 */
export type CommentsCache = InfiniteData<Page<ThreadComment>>;

/** 한 댓글의 답글 목록 키 — 부모 목록 키 아래에 매달아 부모를 지울 때 같이 걷어낸다. */
export const repliesKey = (listKey: readonly unknown[], commentId: number) =>
  [...listKey, commentId, 'replies'] as const;

/** 로컬에 덧붙인 댓글이 다음 페이지에 다시 올 수 있어 id 로 걸러낸다. */
export function dedupeComments(pages: Page<ThreadComment>[] | undefined): ThreadComment[] {
  const seen = new Set<number>();
  const items: ThreadComment[] = [];
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
 * 새 댓글을 목록 끝에 붙인다 — 오래된 순이라 새 글은 마지막 페이지 끝이다.
 * 캐시가 아직 없으면(에러·미조회) 붙일 자리가 없어 false 를 준다. 무효화할지는 호출 쪽이 정한다.
 */
export function appendComment(
  queryClient: QueryClient,
  key: readonly unknown[],
  created: ThreadComment,
): boolean {
  const cache = queryClient.getQueryData<CommentsCache>(key);
  if (!cache || cache.pages.length === 0) return false;
  queryClient.setQueryData<CommentsCache>(key, (old) => {
    if (!old || old.pages.length === 0) return old;
    const pages = old.pages.slice();
    const lastIndex = pages.length - 1;
    pages[lastIndex] = {
      ...pages[lastIndex],
      content: [...(pages[lastIndex].content ?? []), created],
    };
    return { ...old, pages };
  });
  return true;
}

/** 지운 댓글이 어느 페이지에 있는지 알 수 없어 모든 페이지를 훑는다. */
export function removeComment(queryClient: QueryClient, key: readonly unknown[], commentId: number) {
  queryClient.setQueryData<CommentsCache>(key, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            content: (p.content ?? []).filter((c) => c.id !== commentId),
          })),
        }
      : old,
  );
}

/** 캐시에 들어 있는 댓글 한 줄 — 지우기 전에 답글 수를 세는 데 쓴다. */
export function findComment(
  queryClient: QueryClient,
  listKey: readonly unknown[],
  commentId: number,
): ThreadComment | undefined {
  const cache = queryClient.getQueryData<CommentsCache>(listKey);
  for (const page of cache?.pages ?? []) {
    const hit = (page.content ?? []).find((c) => c.id === commentId);
    if (hit) return hit;
  }
  return undefined;
}

/** 부모의 replyCount 를 delta 만큼 옮긴다(0 아래로는 안 내려간다). */
export function bumpReplyCount(
  queryClient: QueryClient,
  listKey: readonly unknown[],
  commentId: number,
  delta: number,
) {
  queryClient.setQueryData<CommentsCache>(listKey, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            content: (p.content ?? []).map((c) =>
              c.id === commentId ? { ...c, replyCount: Math.max(0, c.replyCount + delta) } : c,
            ),
          })),
        }
      : old,
  );
}
