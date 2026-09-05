/**
 * 서버 응답 타입.
 *
 * 실제 정의는 백엔드가 발행하는 OpenAPI 문서에서 생성한다(`npm run types`).
 * 이 파일은 생성 타입에 앱에서 쓰기 좋은 이름을 붙여 다시 내보내는 얇은 층이다.
 * 여기에 필드를 직접 적지 않는다 — 서버와 어긋나기 시작하는 지점이 되기 때문이다.
 */
import type { components } from './generated';

type Schemas = components['schemas'];

/** 페이지 응답 봉투. 서버가 내려주는 형태를 그대로 쓰되 항목 타입만 갈아끼운다. */
export type Page<T> = Omit<Schemas['PageResponseReadingRecordView'], 'content'> & {
  content: T[];
};

// ── 사용자 ───────────────────────────────────────────────
export type Me = Schemas['MeResponse'];
export type TokenResponse = Schemas['TokenResponse'];
export type EmailCodeResponse = Schemas['EmailCodeResponse'];

/** 서버는 문자열로 내려주므로 앱에서 좁혀 쓴다. */
export type NotifyTone = 'GENTLE' | 'FACT' | 'SPARTA' | 'TSUNDERE' | 'SILENT';

// ── 도서 · 서재 ──────────────────────────────────────────
export type BookSummary = Schemas['BookSummary'];
export type BookDetail = Schemas['BookDetail'];
export type BookLikeView = Schemas['BookLikeView'];
export type Progress = Schemas['ProgressView'];
export type ReadingRecord = Schemas['ReadingRecordView'];
export type LibrarySummary = Schemas['LibrarySummary'];
export type ReadingStatus = NonNullable<ReadingRecord['status']>;

// ── 홈 콘텐츠 ────────────────────────────────────────────
export type Banner = Schemas['BannerView'];
export type PopularBook = Schemas['PopularBookView'];

// ── 세션 · 통계 ──────────────────────────────────────────
export type Session = Schemas['SessionView'];
export type SessionEndResult = Schemas['SessionEndResult'];
export type StatsSummary = Schemas['StatsSummary'];
export type DailyStat = Schemas['DailyStat'];

// ── 모임 ─────────────────────────────────────────────────
export type ClubSummary = Schemas['ClubSummaryView'];
export type ClubPreview = Schemas['ClubPreview'];
export type ClubHome = Schemas['ClubHomeView'];
export type ClubResult = Schemas['ClubResultView'];
export type MemberProgress = Schemas['MemberProgressView'];
export type Checkpoint = Schemas['CheckpointView'];
export type ClubPost = Schemas['ClubPostView'];

export type ClubVisibility = NonNullable<ClubHome['visibility']>;
export type ClubStatus = NonNullable<ClubHome['status']>;
export type ClubRole = NonNullable<ClubHome['myRole']>;
export type ClubPostType = NonNullable<ClubPost['type']>;
export type NudgeMessageKey = NonNullable<Schemas['NudgeRequest']['messageKey']>;

// ── 알림 · 리뷰 ──────────────────────────────────────────
export type Notification = Schemas['NotificationView'];
export type Review = Schemas['ReviewView'];
export type VerificationPreview = Schemas['VerificationPreview'];
export type VerificationLevel = NonNullable<Review['verificationLevel']>;

// ── 밑줄 · 광장 ──────────────────────────────────────────
export type BookQuote = Schemas['BookQuoteView'];
export type QuoteAgree = Schemas['QuoteAgreeView'];
export type CreateQuote = Schemas['CreateBookQuoteRequest'];
export type PlazaItem = Schemas['PlazaItemView'];
export type PlazaItemType = PlazaItem['type'];

// ── 챌린지 ───────────────────────────────────────────────
export type Challenge = Schemas['ChallengeView'];
export type ChallengeStatus = Challenge['status'];
