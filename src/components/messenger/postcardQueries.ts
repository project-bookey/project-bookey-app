import type { QueryClient } from '@tanstack/react-query';

import type { PostcardView } from '@/api/types';

/** 받은·보낸 엽서를 섞은 목록(엽서 구역) — 차단·답장 등이 무효화하는 ['postcards'] 아래에 둔다. */
export const postcardListKey = ['postcards', 'ALL'] as const;
/** 엽서 한 장(상세 화면). */
export const postcardKey = (id: number) => ['postcards', 'one', id] as const;

/** 아직 열지 않은 받은 엽서인가 — 목록의 닫힌 봉투. 보낸 엽서에는 openedAt 이 오지 않으니 mine 으로 먼저 거른다. */
export function isSealed(card: PostcardView): boolean {
  return !card.mine && !card.openedAt;
}

/** 엽서 한 장이 바뀌었을 때 목록 캐시의 그 줄도 바꾼다 — 상세에서 연 뒤 돌아오면 목록 봉투가 열린 모양이 되게(다시 받지 않는다). */
export function patchPostcard(queryClient: QueryClient, card: PostcardView) {
  queryClient.setQueryData<PostcardView>(postcardKey(card.id), card);
  queryClient.setQueryData<PostcardView[]>(postcardListKey, (list) =>
    list?.map((item) => (item.id === card.id ? card : item)));
}
