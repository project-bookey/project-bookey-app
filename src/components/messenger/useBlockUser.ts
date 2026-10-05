import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';
import { blockApi } from '@/api/endpoints';
import { confirmAsync, notify } from '@/components/club';

/** 차단 확인 창의 설명 — 무엇이 막히고, 상대가 아는지, 어디서 푸는지. */
const BLOCK_MESSAGE =
  "차단하면 서로 엽서와 채팅을 주고받을 수 없고, 이 사람과의 엽서·채팅방이 목록에서 사라져요. "
  + "상대에게는 알리지 않아요. 설정의 '차단한 사람'에서 언제든 풀 수 있어요.";

/**
 * 사람 차단 — 확인 창을 거쳐 막는다(채팅·엽서 목록 밀기, 채팅방 ⋯ 메뉴, 엽서 화면 발치가 같이 쓴다).
 * 막으면 엽서함·채팅 목록에서 그 사람 것이 빠지므로 두 목록과 차단 목록을 다시 받는다.
 */
export function useBlockUser() {
  const queryClient = useQueryClient();
  const block = useMutation({
    mutationFn: (userId: number) => blockApi.block(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['postcards'] });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
  });

  /** 확인을 받고 막는다 — 막았으면 true, 취소했거나 실패했으면 false(실패는 알림으로 알린다). */
  const confirmBlock = async (userId: number, nickname: string): Promise<boolean> => {
    const ok = await confirmAsync(BLOCK_MESSAGE, '차단', `${nickname}님을 차단할까요?`);
    if (!ok) return false;
    try {
      await block.mutateAsync(userId);
      return true;
    } catch (e) {
      notify(e instanceof ApiError ? e.message : '차단하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return false;
    }
  };

  return { confirmBlock, blocking: block.isPending };
}
