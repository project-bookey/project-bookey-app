import { api } from './client';
import type {
  Banner, BookDetail, BookLikeView, BookQuote, BookSummary, Challenge, Checkpoint, ClubHome, ClubPost, ClubPreview, ClubResult, ClubSummary,
  CreateQuote, CreateQuoteComment, CreateReviewComment, LibrarySummary, Me, Notification, NudgeMessageKey, Page, PlazaItem, PlazaItemType,
  PopularBook, QuoteAgree, QuoteComment, ReadingRecord, ReadingStatus,
  Review, ReviewComment, Session, SessionEndResult, StatsSummary, TokenResponse, VerificationPreview,
} from './types';

export const authApi = {
  socialLogin: (provider: "GOOGLE" | "APPLE" | "KAKAO", token: string, nickname?: string) =>
    api<TokenResponse>("/api/v1/auth/social", { method: "POST", auth: false, body: { provider, token, nickname } }),
  emailLogin: (email: string, password: string) =>
    api<TokenResponse>("/api/v1/auth/login", { method: "POST", auth: false, body: { email, password } }),
  emailSignup: (email: string, password: string, nickname: string) =>
    api<TokenResponse>("/api/v1/auth/signup", { method: "POST", auth: false, body: { email, password, nickname } }),
  logout: () => api<void>("/api/v1/auth/logout", { method: "POST" }),
  me: () => api<Me>("/api/v1/me"),
  updateProfile: (body: { nickname?: string; avatarUrl?: string }) =>
    api<Me>("/api/v1/me", { method: "PATCH", body }),
};

export const bookApi = {
  search: (keyword: string) => api<BookSummary[]>('/api/v1/books', { query: { keyword } }),
  byIsbn: (isbn13: string) => api<BookSummary>(`/api/v1/books/isbn/${isbn13}`),
  detail: (bookId: number) => api<BookDetail>(`/api/v1/books/${bookId}`),
  like: (bookId: number) => api<BookLikeView>(`/api/v1/books/${bookId}/like`, { method: 'POST' }),
  createManual: (body: { title: string; author?: string; totalPages: number }) =>
    api<BookSummary>('/api/v1/books', { method: 'POST', body }),
  reviews: (bookId: number, verifiedOnly = false) =>
    api<Page<Review>>(`/api/v1/books/${bookId}/reviews`, { query: { verifiedOnly } }),
  popular: (size = 20) => api<PopularBook[]>('/api/v1/books/popular', { query: { size } }),
  recommended: (size = 20) => api<BookSummary[]>('/api/v1/books/recommended', { query: { size } }),
};

export const libraryApi = {
  list: (status?: ReadingStatus) =>
    api<Page<ReadingRecord>>('/api/v1/library', { query: { status, size: 50 } }),
  summary: () => api<LibrarySummary>('/api/v1/library/summary'),
  detail: (recordId: number) => api<ReadingRecord>(`/api/v1/library/${recordId}`),
  add: (body: { bookId: number; status?: ReadingStatus; targetFinishDate?: string; totalPagesOverride?: number }) =>
    api<ReadingRecord>('/api/v1/library', { method: 'POST', body }),
  updateGoal: (recordId: number, body: { targetFinishDate?: string; totalPagesOverride?: number }) =>
    api<ReadingRecord>(`/api/v1/library/${recordId}/goal`, { method: 'PATCH', body }),
  updateProgress: (recordId: number, currentPage: number) =>
    api<ReadingRecord>(`/api/v1/library/${recordId}/progress`, { method: 'PATCH', body: { currentPage } }),
  pause: (recordId: number) => api<ReadingRecord>(`/api/v1/library/${recordId}/pause`, { method: 'POST' }),
  resume: (recordId: number) => api<ReadingRecord>(`/api/v1/library/${recordId}/resume`, { method: 'POST' }),
  finish: (recordId: number, rating?: number) =>
    api<ReadingRecord>(`/api/v1/library/${recordId}/finish`, { method: 'POST', body: { rating } }),
  abandon: (recordId: number, reason: string) =>
    api<ReadingRecord>(`/api/v1/library/${recordId}/abandon`, { method: 'POST', body: { reason } }),
};

export const sessionApi = {
  current: async () => (await api<Session | null | undefined>('/api/v1/sessions/current')) ?? null,
  start: (readingRecordId: number, startPage?: number) =>
    api<Session>('/api/v1/sessions/start', { method: 'POST', body: { readingRecordId, startPage } }),
  end: (sessionId: number, body: { endPage?: number; foregroundRatio?: number; interactionCount?: number; memo?: string }) =>
    api<SessionEndResult>(`/api/v1/sessions/${sessionId}/end`, { method: 'POST', body }),
  manual: (body: { readingRecordId: number; startedAt: string; durationSec: number; startPage?: number; endPage?: number; memo?: string }) =>
    api<SessionEndResult>('/api/v1/sessions/manual', { method: 'POST', body }),
  listByRecord: (readingRecordId: number) =>
    api<Session[]>('/api/v1/sessions', { query: { readingRecordId } }),
};

export const statsApi = {
  summary: (days = 90) => api<StatsSummary>('/api/v1/stats', { query: { days } }),
};

export const clubApi = {
  myClubs: () => api<Page<ClubSummary>>('/api/v1/clubs', { query: { size: 50 } }),
  publicClubs: () => api<Page<ClubPreview>>('/api/v1/clubs/public'),
  preview: (code: string) => api<ClubPreview>('/api/v1/clubs/preview', { query: { code } }),
  join: (code: string, body: { adoptTargetDate: boolean; shareProgress: boolean }) =>
    api<ClubHome>('/api/v1/clubs/join', { method: 'POST', body: { code, ...body } }),
  create: (body: {
    name: string; description?: string; bookId: number; startsAt: string; endsAt: string;
    visibility?: string; memberLimit?: number; autoCheckpoints?: boolean; allowNudge?: boolean;
  }) => api<ClubHome>('/api/v1/clubs', { method: 'POST', body }),
  home: (clubId: number) => api<ClubHome>(`/api/v1/clubs/${clubId}`),
  result: (clubId: number) => api<ClubResult>(`/api/v1/clubs/${clubId}/result`),
  rotateCode: (clubId: number) =>
    api<{ joinCode: string }>(`/api/v1/clubs/${clubId}/rotate-code`, { method: 'POST' }),
  updateSharing: (clubId: number, body: { shareProgress?: boolean; allowNudge?: boolean }) =>
    api<void>(`/api/v1/clubs/${clubId}/sharing`, { method: 'PATCH', body }),
  leave: (clubId: number) => api<void>(`/api/v1/clubs/${clubId}/me`, { method: 'DELETE' }),
  end: (clubId: number) => api<void>(`/api/v1/clubs/${clubId}/end`, { method: 'POST' }),
  nudge: (clubId: number, toUserId: number, messageKey: NudgeMessageKey) =>
    api<{ remainingToday: number }>(`/api/v1/clubs/${clubId}/nudges`, {
      method: 'POST',
      body: { toUserId, messageKey },
    }),
  posts: (clubId: number, onlyMyRange: boolean) =>
    api<Page<ClubPost>>(`/api/v1/clubs/${clubId}/posts`, { query: { onlyMyRange, size: 50 } }),
  createPost: (clubId: number, body: {
    type?: string; body: string; anchorPage?: number; spoilerLevel?: string; parentId?: number;
  }) => api<ClubPost>(`/api/v1/clubs/${clubId}/posts`, { method: 'POST', body }),
  reveal: (clubId: number, postId: number) =>
    api<ClubPost>(`/api/v1/clubs/${clubId}/posts/${postId}/reveal`, { method: 'POST' }),
  react: (clubId: number, postId: number, kind: string) =>
    api<void>(`/api/v1/clubs/${clubId}/posts/${postId}/reactions`, { method: 'POST', body: { kind } }),
};

export const notificationApi = {
  list: () => api<Page<Notification>>('/api/v1/notifications', { query: { size: 50 } }),
  open: (id: number) => api<void>(`/api/v1/notifications/${id}/open`, { method: 'POST' }),
  updateSettings: (body: Record<string, unknown>) =>
    api<void>('/api/v1/notifications/settings', { method: 'PATCH', body }),
};

export const bannerApi = {
  list: () => api<Banner[]>('/api/v1/banners', { auth: false }),
};

export const reviewApi = {
  preview: (readingRecordId: number) =>
    api<VerificationPreview>('/api/v1/reviews/preview', { query: { readingRecordId } }),
  create: (body: { readingRecordId: number; rating?: number; body: string; tags?: string[] }) =>
    api<Review>('/api/v1/reviews', { method: 'POST', body }),
  mine: () => api<Page<Review>>('/api/v1/reviews/me'),
  /** 리뷰 한 건 — 상세 진입·새로고침·딥링크. */
  get: (reviewId: number) => api<Review>(`/api/v1/reviews/${reviewId}`),
  /** 댓글 — 오래된 순, 최상위만. */
  comments: (reviewId: number, page = 0, size = 30) =>
    api<Page<ReviewComment>>(`/api/v1/reviews/${reviewId}/comments`, { query: { page, size } }),
  /** 한 댓글의 답글 — 오래된 순. */
  replies: (reviewId: number, commentId: number, page = 0, size = 20) =>
    api<Page<ReviewComment>>(`/api/v1/reviews/${reviewId}/comments/${commentId}/replies`, { query: { page, size } }),
  addComment: (reviewId: number, body: CreateReviewComment) =>
    api<ReviewComment>(`/api/v1/reviews/${reviewId}/comments`, { method: 'POST', body }),
  removeComment: (reviewId: number, commentId: number) =>
    api<void>(`/api/v1/reviews/${reviewId}/comments/${commentId}`, { method: 'DELETE' }),
};

export const quoteApi = {
  create: (body: CreateQuote) => api<BookQuote>('/api/v1/quotes', { method: 'POST', body }),
  /** 내가 오려둔 문장. totalElements 가 총 개수다. */
  mine: (page = 0, size = 20) => api<Page<BookQuote>>('/api/v1/quotes', { query: { page, size } }),
  /** 밑줄 한 건 — 상세 진입·새로고침·딥링크. */
  get: (quoteId: number) => api<BookQuote>(`/api/v1/quotes/${quoteId}`),
  /** 책별 밑줄 — 최신순. 도서 상세 밑줄 탭은 5건씩 받는다. */
  byBook: (bookId: number, page = 0, size = 5) =>
    api<Page<BookQuote>>(`/api/v1/books/${bookId}/quotes`, { query: { page, size } }),
  remove: (quoteId: number) => api<void>(`/api/v1/quotes/${quoteId}`, { method: 'DELETE' }),
  /** '좋아요' 토글 — 서버가 토글 후 상태를 돌려준다. */
  agree: (quoteId: number) => api<QuoteAgree>(`/api/v1/quotes/${quoteId}/agree`, { method: 'POST' }),
  /** 댓글 — 오래된 순. */
  comments: (quoteId: number, page = 0, size = 30) =>
    api<Page<QuoteComment>>(`/api/v1/quotes/${quoteId}/comments`, { query: { page, size } }),
  /** 한 댓글의 답글 — 오래된 순. */
  replies: (quoteId: number, commentId: number, page = 0, size = 20) =>
    api<Page<QuoteComment>>(`/api/v1/quotes/${quoteId}/comments/${commentId}/replies`, { query: { page, size } }),
  addComment: (quoteId: number, body: CreateQuoteComment) =>
    api<QuoteComment>(`/api/v1/quotes/${quoteId}/comments`, { method: 'POST', body }),
  removeComment: (quoteId: number, commentId: number) =>
    api<void>(`/api/v1/quotes/${quoteId}/comments/${commentId}`, { method: 'DELETE' }),
};

export const plazaApi = {
  feed: (type: PlazaItemType, page = 0, size = 20) =>
    api<Page<PlazaItem>>('/api/v1/plaza/feed', { query: { type, page, size } }),
};

export const challengeApi = {
  create: (body: { readingRecordId?: number; bookId?: number; budgetSec: number }) =>
    api<Challenge>('/api/v1/challenges', { method: 'POST', body }),
  active: () => api<Challenge[]>('/api/v1/challenges/active'),
  get: (id: number) => api<Challenge>(`/api/v1/challenges/${id}`),
  start: (id: number) => api<Challenge>(`/api/v1/challenges/${id}/start`, { method: 'POST' }),
  pause: (id: number) => api<Challenge>(`/api/v1/challenges/${id}/pause`, { method: 'POST' }),
  progress: (id: number, currentPage: number) =>
    api<Challenge>(`/api/v1/challenges/${id}/progress`, { method: 'PATCH', body: { currentPage } }),
  cancel: (id: number) => api<void>(`/api/v1/challenges/${id}`, { method: 'DELETE' }),
};

export type { Checkpoint };
