import { api } from './client';
import type {
  Banner, BookDetail, BookLikeView, BookQuote, BookSummary, Challenge, ChatMessage, ChatMessages, ChatSummary,
  Checkpoint, ClubHome, ClubPost, ClubPreview, ClubResult, ClubSummary,
  CreatePost, CreateQuote, CreateQuoteComment, CreateReviewComment,
  EmailCodeResponse, ExchangeTarget, FeedSort, FollowCodeView, FollowUserView,
  LibrarySummary, LikerView, Me, Notification, NudgeMessageKey, Page, PlazaItem, PlazaItemType,
  PopularBook, Post, PostImage, PostLike, PostcardView, QuoteAgree, QuoteComment,
  ReadingRecord, ReadingStatus,
  Review, ReviewComment, Session, SessionEndResult, SignupConfig, StatsSummary, TokenResponse,
  UpdatePost, UserProfileView, VerificationPreview,
  VisitorView, WalletView,
} from './types';

export const authApi = {
  /** 소셜 로그인 — 이미 연동된 계정만 통과한다. 신규 가입은 이메일 가입(인증 코드) 후 연동으로만 가능. */
  socialLogin: (provider: "GOOGLE" | "APPLE" | "KAKAO", token: string) =>
    api<TokenResponse>("/api/v1/auth/social", { method: "POST", auth: false, body: { provider, token } }),
  linkSocial: (provider: "GOOGLE" | "APPLE" | "KAKAO", token: string) =>
    api<Me>("/api/v1/auth/social/link", { method: "POST", body: { provider, token } }),
  emailLogin: (email: string, password: string) =>
    api<TokenResponse>("/api/v1/auth/login", { method: "POST", auth: false, body: { email, password } }),
  /** 가입 화면 구성 — 요구 인증 수단(EMAIL_CODE|IDENTITY)과 포트원 키. */
  signupConfig: () => api<SignupConfig>("/api/v1/auth/signup-config", { auth: false }),
  /** 가입 인증 코드 발급 (EMAIL_CODE 모드) — 로컬 서버는 devCode 를 응답에 동봉한다. */
  requestEmailCode: (email: string) =>
    api<EmailCodeResponse>("/api/v1/auth/email/code", { method: "POST", auth: false, body: { email } }),
  /** 가입 — 서버 설정에 따라 code(이메일 인증) 또는 identityVerificationId(휴대폰 본인인증)를 요구한다. */
  emailSignup: (email: string, password: string, nickname: string,
                verification: { code?: string; identityVerificationId?: string }) =>
    api<TokenResponse>("/api/v1/auth/signup", {
      method: "POST", auth: false, body: { email, password, nickname, ...verification },
    }),
  /** 프로필 사진 업로드 — 온보딩 필수 단계. */
  uploadAvatar: (form: FormData) =>
    api<Me>("/api/v1/me/avatar", { method: "POST", body: form }),
  logout: () => api<void>("/api/v1/auth/logout", { method: "POST" }),
  me: () => api<Me>("/api/v1/me"),
  updateProfile: (body: { nickname?: string; avatarUrl?: string; preferredCategories?: string[] }) =>
    api<Me>("/api/v1/me", { method: "PATCH", body }),
};

export const onboardingApi = {
  /** 온보딩 책 고르기 (비회원) — 카테고리 부분 일치, 표지 있는 책 우선. */
  books: (category?: string, size = 30) =>
    api<BookSummary[]>('/api/v1/public/onboarding/books', { auth: false, query: { category, size } }),
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
  /** YES24 큐레이션 — 베스트셀러·스테디셀러·신상품 (서버 1시간 캐시, 키 없으면 빈 목록). */
  yes24Curation: (kind: 'BESTSELLER' | 'STEADY' | 'NEW' = 'BESTSELLER', size = 20) =>
    api<BookSummary[]>('/api/v1/books/curation/yes24', { query: { kind, size } }),
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

export const walletApi = {
  get: () => api<WalletView>('/api/v1/wallet'),
  /** 책갈피 → 엽서(1책갈피) · 우표(2책갈피) 교환. */
  exchange: (target: ExchangeTarget, quantity: number) =>
    api<WalletView>('/api/v1/wallet/exchange', { method: 'POST', body: { target, quantity } }),
};

export const postcardApi = {
  /** 엽서 보내기 — 16글자, 무료 일 5장(KST 자정 리셋) → 보유 엽서. attachStamp 는 내 우표 1개 소모. */
  send: (body: { toUserId: number; postId?: number; body: string; attachStamp: boolean }) =>
    api<PostcardView>('/api/v1/postcards', { method: 'POST', body }),
  inbox: (page = 0, size = 20) =>
    api<Page<PostcardView>>('/api/v1/postcards/inbox', { query: { page, size } }),
  sent: (page = 0, size = 20) =>
    api<Page<PostcardView>>('/api/v1/postcards/sent', { query: { page, size } }),
  /** 답장 — 우표 1개 소모(동봉 엽서는 무료). 성립하면 자동 맞팔로우. */
  reply: (postcardId: number, body: string) =>
    api<PostcardView>(`/api/v1/postcards/${postcardId}/reply`, { method: 'POST', body: { body } }),
};

export const followApi = {
  myCode: () => api<FollowCodeView>('/api/v1/follows/my-code'),
  rotateCode: () => api<FollowCodeView>('/api/v1/follows/my-code/rotate', { method: 'POST' }),
  /** 코드로 팔로우 — 지인 전제, 즉시 맞팔로우. */
  byCode: (code: string) =>
    api<FollowUserView>('/api/v1/follows/code', { method: 'POST', body: { code } }),
  followers: (page = 0, size = 20) =>
    api<Page<FollowUserView>>('/api/v1/follows/followers', { query: { page, size } }),
  following: (page = 0, size = 20) =>
    api<Page<FollowUserView>>('/api/v1/follows/following', { query: { page, size } }),
  unfollow: (userId: number) => api<void>(`/api/v1/follows/${userId}`, { method: 'DELETE' }),
};

export const chatApi = {
  /** 채팅방 열기 — 맞팔로우인 상대만. 이미 있으면 그 방을 돌려준다. */
  open: (userId: number) => api<ChatSummary>('/api/v1/chats', { method: 'POST', body: { userId } }),
  list: (page = 0, size = 20) => api<Page<ChatSummary>>('/api/v1/chats', { query: { page, size } }),
  /** 메시지 커서 페이지(최신순) — 첫 페이지를 열면 서버가 읽음 처리한다. */
  messages: (chatId: number, beforeId?: number) =>
    api<ChatMessages>(`/api/v1/chats/${chatId}/messages`, { query: { beforeId } }),
  send: (chatId: number, body: string) =>
    api<ChatMessage>(`/api/v1/chats/${chatId}/messages`, { method: 'POST', body: { body } }),
};

export const profileApi = {
  /** 유저 프로필 — 열람하면 방문 기록이 남는다(방문 수는 전체 공개). */
  user: (userId: number) => api<UserProfileView>(`/api/v1/users/${userId}/profile`),
  /** 내 방문자 목록 — 구독 회원 전용. */
  visitors: (page = 0, size = 20) =>
    api<Page<VisitorView>>('/api/v1/me/visitors', { query: { page, size } }),
};

export const notificationApi = {
  list: () => api<Page<Notification>>('/api/v1/notifications', { query: { size: 50 } }),
  open: (id: number) => api<void>(`/api/v1/notifications/${id}/open`, { method: 'POST' }),
  updateSettings: (body: Record<string, unknown>) =>
    api<void>('/api/v1/notifications/settings', { method: 'PATCH', body }),
};

export const bannerApi = {
  list: (kind: 'AD' | 'NOTICE' = 'AD') =>
    api<Banner[]>('/api/v1/banners', { auth: false, query: { kind } }),
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
  /**
   * 내가 오려둔 문장. totalElements 가 총 개수다. bookId 를 주면 그 책 것만 — 독후감 작성 시 밑줄 고르기에 쓴다.
   * q 는 문장 내용·책 제목을 대소문자 무시 부분 일치로 훑는다(빈 값이면 전체).
   */
  mine: (page = 0, size = 20, bookId?: number, q?: string) =>
    api<Page<BookQuote>>('/api/v1/quotes', { query: { page, size, bookId, q } }),
  /** 밑줄 한 건 — 상세 진입·새로고침·딥링크. */
  get: (quoteId: number) => api<BookQuote>(`/api/v1/quotes/${quoteId}`),
  /** 책별 밑줄 — 최신순. 도서 상세 밑줄 탭은 5건씩 받는다. q 는 문장 내용·책 제목 검색. */
  byBook: (bookId: number, page = 0, size = 5, q?: string) =>
    api<Page<BookQuote>>(`/api/v1/books/${bookId}/quotes`, { query: { page, size, q } }),
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
  /** 광장 피드. q 는 문장 내용·책 제목 검색 — 완독 자랑(FINISH)에는 뜻이 없어 서버가 무시한다. */
  feed: (type: PlazaItemType, page = 0, size = 20, q?: string) =>
    api<Page<PlazaItem>>('/api/v1/plaza/feed', { query: { type, page, size, q } }),
};

/** 독후감 — 광장 피드·도서별 목록·내 글, 좋아요·댓글, 붙일 사진 업로드. */
export const postApi = {
  /** 독후감 피드 (§14.1) — HOT: 좋아요·시간 감쇠 점수, NEW: 최신순. */
  feed: (sort: FeedSort = 'HOT', page = 0, size = 10) =>
    api<Page<Post>>('/api/v1/posts/feed', { query: { sort, page, size } }),
  /** 유저 마이페이지의 공개 독후감 — 피드에서 휘발된 글도 여기엔 축적된다. */
  byUser: (userId: number, page = 0, size = 20) =>
    api<Page<Post>>(`/api/v1/users/${userId}/posts`, { query: { page, size } }),
  /** 내 글에 좋아요 누른 사람 — 글 주인 + 구독 회원 전용. */
  likers: (postId: number, page = 0, size = 20) =>
    api<Page<LikerView>>(`/api/v1/posts/${postId}/likers`, { query: { page, size } }),
  byBook: (bookId: number, page = 0, size = 5) =>
    api<Page<Post>>(`/api/v1/books/${bookId}/posts`, { query: { page, size } }),
  mine: (page = 0, size = 20) => api<Page<Post>>('/api/v1/posts', { query: { page, size } }),
  get: (postId: number) => api<Post>(`/api/v1/posts/${postId}`),
  create: (body: CreatePost) => api<Post>('/api/v1/posts', { method: 'POST', body }),
  update: (postId: number, body: UpdatePost) =>
    api<Post>(`/api/v1/posts/${postId}`, { method: 'PATCH', body }),
  remove: (postId: number) => api<void>(`/api/v1/posts/${postId}`, { method: 'DELETE' }),
  like: (postId: number) => api<PostLike>(`/api/v1/posts/${postId}/like`, { method: 'POST' }),
  /** 사진 업로드 — multipart. Content-Type 은 런타임이 boundary 와 함께 붙인다. */
  uploadImage: (form: FormData) => api<PostImage>('/api/v1/posts/images', { method: 'POST', body: form }),
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
