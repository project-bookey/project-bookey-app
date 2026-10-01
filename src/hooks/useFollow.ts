import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { followApi } from '@/api/endpoints';
import type { FollowingIdsView } from '@/api/types';

const FOLLOWING_IDS_KEY = ['followingIds'] as const;

/**
 * 내가 팔로우하는 사람 id 묶음 — 피드·댓글·프로필의 팔로우 버튼이 한 캐시를 같이 본다.
 * 그래서 한 화면에서 누르면 다른 화면의 버튼도 같이 바뀐다.
 */
export function useFollowingIds() {
  const query = useQuery({ queryKey: FOLLOWING_IDS_KEY, queryFn: followApi.followingIds });
  const ids = useMemo(() => new Set(query.data?.ids ?? []), [query.data]);
  return { ids, ready: query.isSuccess };
}

/**
 * 팔로우 토글 (§14.3) — 버튼 한 번으로 바로 팔로우/취소. 응답을 기다리지 않고 캐시를 먼저 바꾸고,
 * 실패하면 되돌린다. 끝나면 수·목록이 걸린 쿼리를 새로 받는다.
 */
export function useFollowToggle(userId: number) {
  const queryClient = useQueryClient();
  const { ids, ready } = useFollowingIds();
  const following = ids.has(userId);

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) await followApi.follow(userId);
      else await followApi.unfollow(userId);
    },
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: FOLLOWING_IDS_KEY });
      const prev = queryClient.getQueryData<FollowingIdsView>(FOLLOWING_IDS_KEY);
      const rest = (prev?.ids ?? []).filter((id) => id !== userId);
      queryClient.setQueryData<FollowingIdsView>(FOLLOWING_IDS_KEY, { ids: next ? [...rest, userId] : rest });
      return { prev };
    },
    onError: (_e, _next, context) => {
      if (context?.prev) queryClient.setQueryData(FOLLOWING_IDS_KEY, context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FOLLOWING_IDS_KEY });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['follows'] });
    },
  });

  return {
    following,
    ready,
    pending: mutation.isPending,
    toggle: () => mutation.mutate(!following),
  };
}
