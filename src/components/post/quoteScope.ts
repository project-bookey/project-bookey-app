import type { BookQuote, PlazaItem } from '@/api/types';

/** 밑줄을 고르는 범위 — 내 것, 글에 고른 책, 광장 전체. */
export type QuoteScope = 'MINE' | 'BOOK' | 'PLAZA';

/**
 * 광장 피드 항목을 밑줄 모양으로 옮긴다.
 *
 * 광장은 밑줄과 완독 자랑을 같은 배열로 내려주므로 밑줄이 아닌 항목은 버린다.
 * `mine` 은 광장 응답에 없어 로그인한 사람과 작성자를 견줘 만든다.
 */
export function plazaItemToQuote(item: PlazaItem, myId?: number): BookQuote | null {
  if (item.type !== 'QUOTE' || item.quoteId == null || item.content == null) {
    return null;
  }
  return {
    id: item.quoteId,
    bookId: item.bookId,
    bookTitle: item.bookTitle,
    bookCoverUrl: item.bookCoverUrl,
    page: item.page,
    content: item.content,
    authorId: item.authorId,
    authorNickname: item.authorNickname,
    authorAvatarUrl: item.authorAvatarUrl,
    agreeCount: item.agreeCount ?? 0,
    agreedByMe: item.agreedByMe ?? false,
    mine: myId != null && item.authorId === myId,
    commentCount: item.commentCount ?? 0,
    createdAt: item.occurredAt,
  };
}
