import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { CommentsCache } from '@/api/commentCache';
import { findComment } from '@/api/commentCache';
import { postApi } from '@/api/endpoints';
import { bumpCommentPatch, patchPostEverywhere, postCommentsKey } from '@/api/postCache';
import type { Page, PostComment } from '@/api/types';
import { PAGE_SIZE } from '@/components/comments';
import type { CommentThreadAdapter, ThreadComment } from '@/components/comments';

/**
 * 독후감 댓글 어댑터 — 공용 스레드가 독후감 API·캐시를 만나는 유일한 창구.
 *
 * 밑줄·리뷰 어댑터와 모양은 같지만 서버 계약이 다르다. `PostCommentView` 는 `replyCount` 가 없고
 * 답글이 루트 안에 `replies[]` 로 인라인이며, `/replies` 엔드포인트도 없다. 백엔드는 그대로 두고
 * 여기서 스레드 계약(`ThreadComment` + `replies(commentId, page, size)`)으로 매핑한다.
 *
 * useMemo 로 고정한다. 매 렌더 새 객체를 넘기면 스레드의 useInfiniteQuery 가 queryFn·키를
 * 계속 갈아치워 쓸데없이 다시 조회한다.
 */

/** 스레드 한 줄 + 인라인 답글. ThreadComment 는 구조적 타입이라 필드가 더 있어도 스레드가 받는다. */
type PostThreadComment = ThreadComment & { replies: PostThreadComment[] };

/** 서버 DTO → 스레드 줄. replyCount 는 인라인 답글 수에서 센다 — 답글의 답글은 없으니 답글 줄은 0. */
function toThread(comment: PostComment): PostThreadComment {
  const replies = comment.replies.map(toThread);
  return { ...comment, replyCount: replies.length, replies };
}

/** 인라인 답글을 한 장짜리 페이지로 — 서버가 답글을 루트 안에 통째로 내려 주므로 더 받을 장은 없다. */
function repliesPage(replies: PostThreadComment[]): Page<PostThreadComment> {
  return {
    content: replies,
    page: 0,
    size: replies.length,
    totalElements: replies.length,
    totalPages: 1,
    hasNext: false,
  };
}

const hasInlineReplies = (comment: ThreadComment | undefined): comment is PostThreadComment =>
  comment != null && Array.isArray((comment as PostThreadComment).replies);

/**
 * 루트 안의 인라인 답글 배열을 고친다.
 *
 * 스레드는 답글을 쓰고 지울 때 답글 캐시(repliesKey)와 루트의 replyCount 만 손본다. 루트 안의
 * 인라인 복사본도 같이 움직여 두지 않으면, 30초 뒤 답글 목록을 다시 받을 때(`replies()` 가 이 복사본을
 * 돌려준다) 방금 쓴 답글이 사라지고 지운 답글이 되살아난다.
 */
function patchInlineReplies(
  queryClient: QueryClient,
  listKey: readonly unknown[],
  match: (root: PostThreadComment) => boolean,
  update: (replies: PostThreadComment[]) => PostThreadComment[],
) {
  queryClient.setQueryData<CommentsCache>(listKey, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            content: (page.content ?? []).map((comment) =>
              hasInlineReplies(comment) && match(comment)
                ? { ...comment, replies: update(comment.replies) }
                : comment,
            ),
          })),
        }
      : old,
  );
}

export function usePostCommentAdapter(postId: number): CommentThreadAdapter {
  const queryClient = useQueryClient();
  return useMemo(() => {
    const listKey = postCommentsKey(postId);
    return {
      listKey,
      enabled: Number.isFinite(postId),
      list: async (page, size) => {
        const result = await postApi.comments(postId, page, size);
        return { ...result, content: result.content.map(toThread) };
      },
      replies: async (commentId) => {
        // 서버 호출이 없다 — 답글은 목록을 받을 때 루트 안에 인라인으로 이미 와 있다.
        const cached = findComment(queryClient, listKey, commentId);
        if (hasInlineReplies(cached)) return repliesPage(cached.replies);
        // 캐시에 루트가 없으면(이론상 없음) 첫 장을 다시 받아 그 안에서 찾고, 그래도 없으면 빈 장.
        const first = await postApi.comments(postId, 0, PAGE_SIZE);
        const root = first.content.find((comment) => comment.id === commentId);
        return repliesPage(root ? toThread(root).replies : []);
      },
      create: async (body, parentId) => {
        const created = toThread(await postApi.addComment(postId, { body, parentId }));
        // 답글 캐시에 붙이는 일은 스레드가 한다 — 여기서는 루트 안의 인라인 복사본만 따라가게 둔다.
        if (parentId != null) {
          patchInlineReplies(queryClient, listKey, (root) => root.id === parentId, (replies) => [...replies, created]);
        }
        return created;
      },
      remove: async (commentId) => {
        await postApi.removeComment(postId, commentId);
        // 답글이었다면 루트 안의 인라인 복사본에서도 걷어낸다(루트 삭제는 스레드가 캐시째 지운다).
        patchInlineReplies(
          queryClient,
          listKey,
          (root) => root.replies.some((reply) => reply.id === commentId),
          (replies) => replies.filter((reply) => reply.id !== commentId),
        );
      },
      // PostView.commentCount 는 답글까지 센 값이라 스레드가 넘기는 delta(루트 삭제 시 답글 포함)와 맞는다.
      onCountChange: (delta) => patchPostEverywhere(queryClient, postId, bumpCommentPatch(delta)),
    };
  }, [queryClient, postId]);
}
