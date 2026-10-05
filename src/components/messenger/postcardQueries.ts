import { useQuery } from '@tanstack/react-query';
import { postcardApi } from '@/api/endpoints';
import type { Page, PostcardView } from '@/api/types';

export const POSTCARDS_KEY = ['postcards', 'ALL'] as const;
const PAGE_SIZE = 50;

export function mergePostcards(inbox: Page<PostcardView>, sent: Page<PostcardView>): PostcardView[] {
  const time = (card: PostcardView) => Date.parse(card.createdAt);
  const cutoff = Math.max(
    ...[inbox, sent].filter((page) => page.hasNext && page.content.length > 0)
      .map((page) => Math.min(...page.content.map(time))), -Infinity,
  );
  return [...inbox.content, ...sent.content].filter((card) => time(card) >= cutoff)
    .sort((a, b) => time(b) - time(a) || b.id - a.id);
}

export function usePostcards() {
  return useQuery({
    queryKey: POSTCARDS_KEY,
    queryFn: async () => {
      const [inbox, sent] = await Promise.all([
        postcardApi.inbox(0, PAGE_SIZE), postcardApi.sent(0, PAGE_SIZE),
      ]);
      return mergePostcards(inbox, sent);
    },
  });
}

/** 서버에 상세 조회 API가 없어 직접 연 주소는 기존 두 목록 API로 찾는다. */
export async function findPostcard(id: number): Promise<PostcardView | null> {
  let inboxNext = true;
  let sentNext = true;
  for (let page = 0; inboxNext || sentNext; page += 1) {
    const [inbox, sent]: [Page<PostcardView> | null, Page<PostcardView> | null] = await Promise.all([
      inboxNext ? postcardApi.inbox(page, PAGE_SIZE) : null,
      sentNext ? postcardApi.sent(page, PAGE_SIZE) : null,
    ]);
    const found = [...(inbox?.content ?? []), ...(sent?.content ?? [])].find((card) => card.id === id);
    if (found) return found;
    inboxNext = inbox?.hasNext === true;
    sentNext = sent?.hasNext === true;
  }
  return null;
}
