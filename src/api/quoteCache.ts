import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { BookQuote, Page, PlazaItem, PlazaItemType, Post } from '@/api/types';

/**
 * 밑줄 캐시 — 같은 문장이 다섯 곳에 산다.
 *
 * 광장 무한 피드 · 홈 스포트라이트 · 책별 목록 · 상세 · 독후감 상세에 첨부된 밑줄. 좋아요·댓글 수가 바뀌면
 * 다섯 곳을 한 번에 손봐야 화면끼리 어긋나지 않는다. 키와 패치를 여기 한 곳에 둔다.
 */
export const plazaFeedKey = (type: PlazaItemType) => ['plaza', type] as const;
/** 홈 '오려둔 글' 스포트라이트의 밑줄 몫(HomeScraps) — 광장 피드와 갈라 둔 키. */
export const PLAZA_HOME_KEY = ['plaza', 'QUOTE', 'home'] as const;
/** 책별 밑줄(도서 상세 밑줄 탭). `['quotes']` 뿌리라 내 밑줄과 같이 무효화된다. */
export const bookQuotesKey = (bookId: number) => ['quotes', 'book', bookId] as const;
/**
 * 밑줄 고르기 시트의 세 범위 — 검색어(q)가 키 끝에 붙는다.
 *
 * 문장 찾기는 서버가 맡는다(내용·책 제목 부분 일치). 검색어마다 목록이 아예 다른 데다 쪽 번호도 따로 매겨지므로
 * 캐시를 그만큼 갈라 둔다 — 한 캐시에 검색어가 다른 쪽이 섞이면 '더 보기'가 엉뚱한 문장을 이어 붙인다.
 * 검색어 없음은 빈 문자열이고, 그게 곧 전체 목록이다.
 */
/**
 * '이 책' 범위 — 도서 상세 밑줄 탭과 쪽 크기가 달라(5 vs 20) 캐시를 나눠 쓴다.
 * 한 캐시에 크기가 다른 쪽이 섞이면 '더 보기'가 그 사이 문장을 건너뛴다.
 */
export const bookQuotesPickerKey = (bookId: number, q = '') =>
  ['quotes', 'book', bookId, 'picker', q] as const;
/** 내 밑줄 전체(독후감 밑줄 고르기 시트) — 최신순 무한 목록. 프로필의 ['quotes', 'mine'](최신 한 건)과는 다른 키다. */
export const myQuotesKey = (q = '') => ['quotes', 'mine', 'all', q] as const;
/** '광장' 범위 — 광장 화면의 무한 피드와 캐시를 나눠 쓴다. */
export const plazaQuotesKey = (q = '') => ['plaza', 'QUOTE', 'picker', q] as const;
export const quoteKey = (quoteId: number) => ['quote', quoteId] as const;
export const quoteCommentsKey = (quoteId: number) => ['quote', quoteId, 'comments'] as const;

export type PlazaFeedCache = InfiniteData<Page<PlazaItem>>;
export type BookQuotesCache = InfiniteData<Page<BookQuote>>;
export type MyQuotesCache = InfiniteData<Page<BookQuote>>;

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

/**
 * 방금 오린 문장을 내 밑줄 목록 첫 페이지 맨 앞에 끼운다 — 다시 받아오기 전에도 바로 보이게.
 * 검색 중인 목록에는 끼우지 않는다(검색어에 걸리는 문장인지 판단은 서버 몫이다) — 검색 없는 전체 목록만 손보고,
 * 나머지는 invalidateQuoteLists 가 다시 받아오게 한다.
 */
export function prependMyQuote(queryClient: QueryClient, quote: BookQuote) {
  queryClient.setQueryData<MyQuotesCache>(myQuotesKey(), (old) =>
    old
      ? { ...old, pages: old.pages.map((p, i) => (i === 0 ? { ...p, content: [quote, ...(p.content ?? [])] } : p)) }
      : old,
  );
}

/** 밑줄이 생기거나 지워졌을 때 — 목록 캐시를 전부 다시 받게 한다. */
export function invalidateQuoteLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['plaza'] });
  queryClient.invalidateQueries({ queryKey: ['quotes'] });
}
