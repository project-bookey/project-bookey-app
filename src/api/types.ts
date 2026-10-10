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
export type SignupConfig = Schemas['SignupConfigResponse'];
/** 카카오 교환 코드로 받은 카카오 accessToken — socialLogin·linkSocial(KAKAO)의 token 으로 보낸다. */
export type KakaoToken = Schemas['KakaoTokenResponse'];

// ── 앱 설정 ─────────────────────────────────────────────
/** 앱을 켤 때 읽는 설정 — 강제·권장 업데이트와 점검 안내(관리자 '앱 버전 · 점검'). */
export type AppConfig = Schemas['AppConfigView'];
/** 끝나지 않은 가장 가까운 점검 — active 면 지금 점검 중, 아니면 예고. */
export type MaintenanceNotice = Schemas['MaintenanceView'];
export type AppPlatform = 'IOS' | 'ANDROID';

// ── 약관·동의 ────────────────────────────────────────────
/** 약관·정책 원문 — 서버가 단일 원천이다(앱 가입 화면과 웹 정책 페이지가 같은 글을 쓴다). */
export type LegalDocument = Schemas['LegalDocumentView'];
/** GET /api/v1/public/legal/{key} 의 key — 공개된 문서만. */
export type LegalDocumentKey = 'terms' | 'privacy-consent' | 'profile-optional' | 'marketing' | 'privacy-policy' | 'refund';
/** 가입 동의 — 필수(약관·개인정보·만 14세)와 선택(광고성 정보 수신). version 은 화면에 보여 준 문서의 것. */
export type SignupConsent = Schemas['SignupConsent'];
/** 종류별 지금 동의 상태 — Me.consents. */
export type ConsentState = Schemas['ConsentStateView'];
export type ConsentKind = ConsentState['kind'];

// ── 소셜 (§14) — 피드 · 엽서 · 지갑 · 팔로우 · 프로필 ────
export type PostView = Schemas['PostView'];
export type PostLikeResult = Schemas['PostLikeView'];
/** 피드 정렬 — HOT: 좋아요·시간 감쇠, NEW: 최신순. */
export type FeedSort = 'HOT' | 'NEW';
export type WalletView = Schemas['WalletView'];
export type ExchangeTarget = NonNullable<Schemas['ExchangeRequest']['target']>;
export type PostcardView = Schemas['PostcardView'];
export type PostcardStatus = NonNullable<PostcardView['status']>;
export type FollowingIdsView = Schemas['FollowingIdsView'];
export type FollowUserView = Schemas['FollowUserView'];
export type UserProfileView = Schemas['UserProfileView'];
export type VisitorView = Schemas['VisitorView'];
export type LikerView = Schemas['LikerView'];
export type ChatSummary = Schemas['ChatSummaryView'];
export type BlockedUser = Schemas['BlockedUserView'];
export type ChatMessage = Schemas['ChatMessageView'];
export type ChatMessages = Schemas['ChatMessagesView'];

/** 서버는 문자열로 내려주므로 앱에서 좁혀 쓴다. */
export type NotifyTone = 'GENTLE' | 'FACT' | 'SPARTA' | 'TSUNDERE' | 'SILENT';

// ── 도서 · 서재 ──────────────────────────────────────────
export type BookSummary = Schemas['BookSummary'];
export type BookDetail = Schemas['BookDetail'];
export type BookLikeView = Schemas['BookLikeView'];
export type Progress = Schemas['ProgressView'];
export type ReadingRecord = Schemas['ReadingRecordView'] & { commitment?: string };
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

// ── 클럽 ─────────────────────────────────────────────────
export type ClubSummary = Schemas['ClubSummaryView'];
export type ClubMemberBrief = Schemas['ClubMemberBrief'];
export type ClubPreview = Schemas['ClubPreview'];
export type ClubHome = Schemas['ClubHomeView'];
export type ClubResult = Schemas['ClubResultView'];
export type MemberProgress = Schemas['MemberProgressView'];
export type Checkpoint = Schemas['CheckpointView'];
export type ClubPost = Schemas['ClubPostView'];
export type ClubSeatPolicy = Schemas['ClubSeatPolicy'];
export type ClubSeatResult = Schemas['ClubSeatResult'];
export type ClubLogDay = Schemas['ClubLogDayView'];
export type ClubLogWeek = Schemas['ClubLogWeekView'];
export type ClubLogSummary = Schemas['ClubLogSummary'];
export type ClubLogDayCount = Schemas['ClubLogDayCount'];
export type ReadingNow = Schemas['ReadingNowView'];
export type ClubVisibility = NonNullable<ClubHome['visibility']>;
export type ClubStatus = NonNullable<ClubHome['status']>;
export type ClubRole = NonNullable<ClubHome['myRole']>;
export type ClubPostType = NonNullable<ClubPost['type']>;
export type NudgeMessageKey = NonNullable<Schemas['NudgeRequest']['messageKey']>;
/** 함께 독서 기록 카드 — 스탑워치를 끝낼 때 생기고, 독후감 노트에 스티커로 붙인다. */
export type ActivityCard = Schemas['ActivityCardView'];
/**
 * 모임 공유 노트 — 모임 하나에 대형노트 한 권, 멤버가 함께 꾸민다. 아직 아무도 쓰지 않았으면 id 가 없고 version 0.
 * document 는 { [key: string]: unknown } 으로 온다 — 앱의 NoteDoc(note/noteDoc.ts)으로 경계에서 좁힌다.
 */
export type MeetingNote = Schemas['MeetingNoteView'];
export type MeetingNoteImage = Schemas['MeetingNoteImageView'];
export type MeetingNoteOpsResult = Schemas['MeetingNoteOpsResult'];

// ── 알림 · 리뷰 ──────────────────────────────────────────
export type Notification = Schemas['NotificationView'];
export type Review = Schemas['ReviewView'];
export type UpdateReview = Schemas['UpdateReviewRequest'];
export type ReviewComment = Schemas['ReviewCommentView'];
export type CreateReviewComment = Schemas['CreateReviewCommentRequest'];
/** 한 마디 — 완독·하차 때 남기는 한 줄. 읽기 기록마다 하나, 도서 상세에 최신순으로 돈다. */
export type Remark = Schemas['RemarkView'];
export type RemarkKind = Remark['kind'];

// ── 광장 ─────────────────────────────────────────────────
export type PlazaItem = Schemas['PlazaItemView'];
export type PlazaItemType = PlazaItem['type'];
/** 옛 독후감에 엮여 있던 밑줄(`Post.quotes`) — 앱은 밑줄 기능을 걷어냈고, 옛 글을 조각 글로 바꿀 때만 읽는다. */
export type BookQuote = Schemas['BookQuoteView'];

// ── 독후감 ───────────────────────────────────────────────
export type Post = Schemas['PostView'];
export type CreatePost = Schemas['CreatePostRequest'];
export type UpdatePost = Schemas['UpdatePostRequest'];
export type PostVisibility = Post['visibility'];
export type PostImage = Schemas['PostImageView'];
export type PostLike = Schemas['PostLikeView'];
export type PostComment = Schemas['PostCommentView'];
export type CreatePostComment = Schemas['CreatePostCommentRequest'];

// ── 고객문의 · FAQ ───────────────────────────────────────
/** 문의 한 건과 답변 — 1문 1답. 답변한 관리자는 내려오지 않는다(앱은 'Bookey 답변'으로만 보여 준다). */
export type Inquiry = Schemas['InquiryView'];
export type InquirySummary = Schemas['InquirySummaryView'];
export type InquiryStatus = Inquiry['status'];
export type InquiryCategory = Inquiry['category'];
/** 작성 화면의 유형 칩 — 서버 순서 그대로, 맨 앞이 기본값. */
export type InquiryCategoryOption = Schemas['InquiryCategoryView'];
export type InquiryImage = Schemas['InquiryImageView'];
export type CreateInquiry = Schemas['CreateInquiryRequest'];
export type Faq = Schemas['FaqView'];

// ── 소설 · 릴레이노벨 ───────────────────────────────────
export type NovelSummary = Schemas['NovelSummary'];
export type NovelDetail = Schemas['NovelDetail'];
export type NovelKind = NovelSummary['kind'];
export type NovelStatus = NovelSummary['status'];
export type CreateNovel = Schemas['CreateNovelRequest'];
export type NovelChapterSummary = Schemas['NovelChapterSummary'];
export type NovelChapter = Schemas['NovelChapterView'];
export type NovelDraft = Schemas['NovelDraftView'];
export type NovelWrite = Schemas['NovelWriteRequest'];
export type NovelCover = Schemas['NovelCoverView'];
