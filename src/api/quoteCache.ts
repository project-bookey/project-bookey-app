import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { BookQuote, Page, PlazaItem, PlazaItemType, Post } from '@/api/types';

/**
 * 밑줄 캐시 — 같은 문장이 다섯 곳에 산다.
 *
 * 광장 무한 피드 · 홈 스포트라이트 · 책별 목록 · 상세 · 독후감 상세에 첨부된 밑줄. 좋아요·댓글 수가 바뀌면
 * 다섯 곳을 한 번에 손봐야 화면끼리 어긋나지 않는다. 키와 패치를 여기 한 곳에 둔다.
 */
export const plazaFeedKey = (type: PlazaItemType) => ['plaza', type] as const;
/** 홈 '오려둔 문장' 스포트라이트(QuoteScraps) — 광장 피드와 갈라 둔 키. */
export const PLAZA_HOME_KEY = ['plaza', 'QUOTE', 'home'] as const;
/** 책별 밑줄(도서 상세 밑줄 탭). `['quotes']` 뿌리라 내 밑줄과 같이 무효화된다. */
export const bookQuotesKey = (bookId: number) => ['quotes', 'book', bookId] as const;
export const quoteKey = (quoteId: number) => ['quote', quoteId] as const;
export const quoteCommentsKey = (quoteId: number) => ['quote', quoteId, 'comments'] as const;

export type PlazaFeedCache = InfiniteData<Page<PlazaItem>>;
export type BookQuotesCache = InfiniteData<Page<BookQuote>>;

/** 다섯 캐시가 공통으로 가진 반응 필드 — 패치는 이것만 건드린다. */
export type QuoteReaction = { agreedByMe?: boolean; agreeCount?: number; commentCount?: number };
export type QuotePatch =
  | Partial<QuoteReaction>
  | ((current: QuoteReaction) => Partial<QuoteReaction>);

/** 항목 스스로의 현재 상태를 뒤집는다 — 캐시마다 값이 달라도 각자 일관되게 움직인다. */
export function toggleAgreePatch(current: QuoteReaction): Partial<QuoteReaction> {
  const agreed = !(current.agreedByMe ?? false);
  return {
    agreedByMe: agreed,
    agreeCount: Math.max(0, (current.agreeCount ?? 0) + (agreed ? 1 : -1)),
  };
}

/** 댓글 수를 delta 만큼 옮긴다(0 아래로는 안 내려간다). */
export function bumpCommentPatch(delta: number) {
  return (current: QuoteReaction): Partial<QuoteReaction> => ({
    commentCount: Math.max(0, (current.commentCount ?? 0) + delta),
  });
}

function resolve(patch: QuotePatch, current: QuoteReaction): Partial<QuoteReaction> {
  return typeof patch === 'function' ? patch(current) : patch;
}

/** 한 문장을 다섯 캐시에서 찾아 같은 패치를 적용한다. 없는 캐시는 건너뛴다. */
export function patchQuoteEverywhere(queryClient: QueryClient, quoteId: number, patch: QuotePatch) {
  const patchItem = (item: PlazaItem): PlazaItem =>
    item.quoteId === quoteId ? { ...item, ...resolve(patch, item) } : item;
  const patchQuote = (quote: BookQuote): BookQuote =>
    quote.id === quoteId ? { ...quote, ...resolve(patch, quote) } : quote;

  queryClient.setQueryData<PlazaFeedCache>(plazaFeedKey('QUOTE'), (old) =>
    old
      ? { ...old, pages: old.pages.map((p) => ({ ...p, content: (p.content ?? []).map(patchItem) })) }
      : old,
  );
  queryClient.setQueryData<Page<PlazaItem>>(PLAZA_HOME_KEY, (old) =>
    old ? { ...old, content: (old.content ?? []).map(patchItem) } : old,
  );
  queryClient.setQueriesData<BookQuotesCache>({ queryKey: ['quotes', 'book'] }, (old) =>
    old
      ? { ...old, pages: old.pages.map((p) => ({ ...p, content: (p.content ?? []).map(patchQuote) })) }
      : old,
  );
  queryClient.setQueryData<BookQuote>(quoteKey(quoteId), (old) => (old ? patchQuote(old) : old));
  // 독후감 상세(['post', id])에 첨부된 밑줄도 같은 문장이다 — 다섯째 자리. 접두 매칭이라
  // ['post', id, 'comments'] 까지 걸리므로 길이 2 인 키만 고르고, 그 문장을 실제로 담은 캐시일 때만
  // 새 객체를 돌려준다(안 그러면 관계없는 상세까지 다시 그린다).
  queryClient.setQueriesData<Post>(
    { queryKey: ['post'], predicate: (query) => query.queryKey.length === 2 },
    (old) =>
      old && Array.isArray(old.quotes) && old.quotes.some((quote) => quote.id === quoteId)
        ? { ...old, quotes: old.quotes.map(patchQuote) }
        : old,
  );
}

/** 밑줄이 생기거나 지워졌을 때 — 목록 캐시를 전부 다시 받게 한다. */
export function invalidateQuoteLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['plaza'] });
  queryClient.invalidateQueries({ queryKey: ['quotes'] });
}
