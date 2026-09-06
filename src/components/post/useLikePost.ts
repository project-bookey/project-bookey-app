import { useMutation, useQueryClient } from '@tanstack/react-query';

import { postApi } from '@/api/endpoints';
import {
  POST_HOME_KEY, patchPostEverywhere, postFeedKey, postKey, toggleLikePatch,
} from '@/api/postCache';

/**
 * 독후감 '좋아요' 낙관 토글 — 광장·상세·책별 목록이 같이 쓴다(useAgreeQuote 와 같은 꼴).
 *
 * 응답을 기다리는 사이 같은 글을 또 누르면 두 뮤테이션이 서로 엇갈려 서버와 다른 카운트가
 * 화면에 눌러앉는다(staleTime + 포커스 재조회 꺼짐이라 저절로 낫지 않는다). 그래서 글 단위로
 * 한 번에 하나씩만 보낸다. 실패하면 같은 토글을 한 번 더 적용해 되돌린다.
 *
 * 여러 화면이 동시에 떠 있어도 글 하나에 토글 하나만 보내도록 화면이 아니라 모듈에 둔다.
 */
const inflight = new Set<number>();

export function useLikePost(): (postId: number) => void {
  const queryClient = useQueryClient();

  const like = useMutation({
    mutationFn: (postId: number) => postApi.like(postId),
    onMutate: async (postId) => {
      // 진행 중인 재조회가 낙관 패치를 덮어쓰지 않게 먼저 멈춘다.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: postFeedKey }),
        queryClient.cancelQueries({ queryKey: POST_HOME_KEY }),
        queryClient.cancelQueries({ queryKey: ['posts', 'book'] }),
        queryClient.cancelQueries({ queryKey: ['posts', 'mine'] }),
        // exact: true — postCommentsKey 가 postKey 를 접두사로 쓰기 때문에 그냥 두면 댓글 조회까지 취소된다.
        queryClient.cancelQueries({ queryKey: postKey(postId), exact: true }),
      ]);
      patchPostEverywhere(queryClient, postId, toggleLikePatch);
    },
    onError: (_error, postId) => {
      patchPostEverywhere(queryClient, postId, toggleLikePatch);
    },
    onSuccess: (result, postId) => {
      patchPostEverywhere(queryClient, postId, {
        likedByMe: result.liked,
        likeCount: result.likeCount,
      });
    },
    // 성공이든 실패든 잠금을 풀어 준다. 여기서 무효화하지 않는다 —
    // 무한 피드 전 페이지를 다시 받아 오는 값이 토글 하나에 비해 너무 비싸다.
    onSettled: (_result, _error, postId) => {
      inflight.delete(postId);
    },
  });

  return (postId: number) => {
    if (inflight.has(postId)) return;
    inflight.add(postId);
    like.mutate(postId);
  };
}
