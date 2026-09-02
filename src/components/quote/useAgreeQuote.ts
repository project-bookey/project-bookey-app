import { useMutation, useQueryClient } from '@tanstack/react-query';

import { quoteApi } from '@/api/endpoints';
import {
  PLAZA_HOME_KEY, patchQuoteEverywhere, plazaFeedKey, quoteKey, toggleAgreePatch,
} from '@/api/quoteCache';

/**
 * '나도 그럼' 낙관 토글 — 광장·상세가 같이 쓴다.
 *
 * 응답을 기다리는 사이 같은 문장을 또 누르면 두 뮤테이션이 서로 엇갈려 서버와 다른 카운트가
 * 화면에 눌러앉는다(staleTime + 포커스 재조회 꺼짐이라 저절로 낫지 않는다). 그래서 문장 단위로
 * 한 번에 하나씩만 보낸다. 실패하면 같은 토글을 한 번 더 적용해 되돌린다.
 *
 * 광장과 상세가 동시에 떠 있어도 문장 하나에 토글 하나만 보내도록 화면이 아니라 모듈에 둔다.
 */
const inflight = new Set<number>();

export function useAgreeQuote(): (quoteId: number) => void {
  const queryClient = useQueryClient();

  const agree = useMutation({
    mutationFn: (quoteId: number) => quoteApi.agree(quoteId),
    onMutate: async (quoteId) => {
      // 진행 중인 재조회가 낙관 패치를 덮어쓰지 않게 먼저 멈춘다.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: plazaFeedKey('QUOTE') }),
        queryClient.cancelQueries({ queryKey: PLAZA_HOME_KEY }),
        queryClient.cancelQueries({ queryKey: ['quotes', 'book'] }),
        // exact: true — quoteCommentsKey 가 quoteKey 를 접두사로 쓰기 때문에 그냥 두면 댓글 조회까지 취소된다.
        queryClient.cancelQueries({ queryKey: quoteKey(quoteId), exact: true }),
      ]);
      patchQuoteEverywhere(queryClient, quoteId, toggleAgreePatch);
    },
    onError: (_error, quoteId) => {
      patchQuoteEverywhere(queryClient, quoteId, toggleAgreePatch);
    },
    onSuccess: (result, quoteId) => {
      patchQuoteEverywhere(queryClient, quoteId, {
        agreedByMe: result.agreed,
        agreeCount: result.agreeCount,
      });
    },
    // 성공이든 실패든 잠금을 풀어 준다. 여기서 무효화하지 않는다 —
    // 무한 피드 전 페이지를 다시 받아 오는 값이 토글 하나에 비해 너무 비싸다.
    onSettled: (_result, _error, quoteId) => {
      inflight.delete(quoteId);
    },
  });

  return (quoteId: number) => {
    if (inflight.has(quoteId)) return;
    inflight.add(quoteId);
    agree.mutate(quoteId);
  };
}
