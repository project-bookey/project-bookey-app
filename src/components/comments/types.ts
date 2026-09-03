/**
 * 댓글 스레드 공용 타입 — 밑줄·리뷰가 같은 스레드를 쓰기 위한 계약.
 *
 * 스레드는 서버 DTO 를 직접 알지 않는다. 화면이 만든 어댑터 하나만 보고 목록·답글·작성·삭제를
 * 부탁한다. 상수도 여기 둔다 — CommentThread 와 그 자식(ReplyList·ThreadComposer)이 같이 쓰는데,
 * 부모에 두면 자식이 부모를 다시 import 하는 순환이 생기기 때문이다.
 */
import type { Page } from '@/api/types';

/** 댓글 한 페이지 — 오래된 순이라 다음 페이지가 더 새 댓글이다. */
export const PAGE_SIZE = 30;
/** 답글 한 페이지 — 한 댓글에 몇 줄뿐이라 댓글보다 작게 받는다. */
export const REPLY_PAGE_SIZE = 20;
/** 댓글 길이 상한 — 서버 계약과 같은 값. */
export const BODY_MAX = 300;
/** 삭제 재확인이 살아 있는 시간(ms). 광장·밑줄과 같은 값. */
export const DELETE_CONFIRM_MS = 3000;

/** 스레드 한 줄 — QuoteCommentView·ReviewCommentView 가 구조적으로 만족한다(두 DTO 의 교집합). */
export type ThreadComment = {
  id: number;
  parentId?: number;
  replyCount: number;
  authorId: number;
  authorNickname: string;
  authorAvatarUrl?: string;
  body: string;
  mine: boolean;
  createdAt: string;
};

/** 답글을 달 대상 — 입력 바 위 칩에 이름을 띄우고, 작성 시 parentId 로 쓴다. */
export type ReplyTarget = { id: number; nickname: string };

/** 스레드가 서버·캐시를 만나는 유일한 창구 — 밑줄·리뷰가 각자 하나씩 만든다. */
export type CommentThreadAdapter = {
  /** 최상위 댓글 목록 캐시 키. 답글 키는 이 키 아래에 매단다. */
  listKey: readonly unknown[];
  /** 대상 id 가 NaN 이면 false — 목록을 아예 부르지 않는다. */
  enabled: boolean;
  list: (page: number, size: number) => Promise<Page<ThreadComment>>;
  replies: (commentId: number, page: number, size: number) => Promise<Page<ThreadComment>>;
  create: (body: string, parentId?: number) => Promise<ThreadComment>;
  remove: (commentId: number) => Promise<void>;
  /** 대상(밑줄/리뷰)의 commentCount 를 delta 만큼 옮긴다. */
  onCountChange: (delta: number) => void;
};
