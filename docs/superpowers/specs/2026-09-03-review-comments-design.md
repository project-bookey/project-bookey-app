# 리뷰 상세 · 댓글 · 대댓글, 밑줄 조각 단순화 — 설계 문서

2026-09-03 · 사용자 피드백으로 결정
전제: [밑줄 댓글 스펙](2026-09-02-quote-comments-design.md). 그 스펙에서 백로그로 둔 "댓글의 답글(중첩)"을
이 스펙이 구현하고, 리뷰에도 같은 댓글 체계를 붙인다.

## 목표

1. 도서 상세 **밑줄 탭**은 유지하되 조각에는 **문장(+쪽)만** 보이고, 누르면 밑줄 상세로.
2. 도서 상세 **리뷰 탭**은 짧은 조각(닉네임·★·본문 2줄·검증 라벨·댓글 N)이고, 누르면 **리뷰 상세**(전문 + 댓글).
3. 밑줄 댓글·리뷰 댓글에 **한 단계 답글**. 댓글 아래 "답글 N개 보기 / 답글 접기"로 접고 펼친다(펼칠 때 로드).

## 범위 밖

답글의 답글 · 댓글 수정 · 답글 알림 · 신고/모더레이션 · 리뷰 삭제/수정(`ReviewView.mine` 없음) · helpful 노출 ·
단독 밑줄 페이지(철회) · 홈 스포트라이트/광장 변경.

## 백엔드 (project-bookey-backend, 브랜치 `feature/comment-replies`)

테이블 두 개 방식(폴리모픽 테이블은 파괴적 마이그레이션·FK 상실로 기각).

- **V10 `comment_replies`**: `quote_comments.parent_id BIGINT REFERENCES quote_comments(id) ON DELETE CASCADE`
  + 부분 인덱스 `(parent_id, created_at, id) WHERE parent_id IS NOT NULL`; 신규 `review_comments`
  (`review_id` FK reviews CASCADE, `user_id` FK users CASCADE, `parent_id` 자기참조 CASCADE, `body VARCHAR(300)`)
  + `(review_id, created_at, id)` + 같은 부분 인덱스.
- **계약**(이름 유지, 필드 추가만): `CreateQuoteCommentRequest { body, parentId? }`,
  `QuoteCommentView { id, quoteId, parentId?, authorId, authorNickname, authorAvatarUrl?, body, mine, replyCount, createdAt }`;
  신규 `CreateReviewCommentRequest`, `ReviewCommentView`(같은 모양, `reviewId`); `ReviewView.commentCount`(답글 포함).
- **API**: `GET /api/v1/quotes/{id}/comments` 는 **최상위만**(오래된 순, `replyCount` 배치),
  `GET /api/v1/quotes/{id}/comments/{commentId}/replies`(오래된 순, size 기본 20·상한 100),
  `POST` 에 `parentId` → 부모가 답글이면 400 `INVALID_REQUEST` "답글에는 답글을 달 수 없습니다.";
  `DELETE` 부모 → 답글 CASCADE. 리뷰는 `/api/v1/reviews/{reviewId}/comments` 에 같은 4종(숨김·삭제 리뷰는
  `REVIEW_NOT_FOUND`, rate key `review:comment:{userId}` 20/분). `GET /api/v1/reviews/{reviewId}` 단건.
  `countPerQuote`/`countPerReview` 는 답글 포함 전체 수.
- **에러 코드**: `REVIEW_NOT_FOUND`(기존 generic NOT_FOUND 교체), `REVIEW_COMMENT_NOT_FOUND`.
- 테스트: 순수 단위(조립 매핑·1단계 규칙·toView). CASCADE·라우팅·답글 포함 카운트는 스모크.

## 앱 (project-bookey-app, 브랜치 `feature/review-comments`)

- **공용 스레드** `src/components/comments/`: `CommentThread`(목록·펼침 Set·답글 대상·삭제 확인·뮤테이션 소유) +
  `CommentRow`(메타 줄에 `답글 달기`, 아래 `답글 N개 보기`/`답글 접기` — 라벨이 상태) + `ReplyList`(펼칠 때만
  마운트, 일반 View, 20개 + 더 보기, 들여쓰기 34px) + `ThreadComposer`(하단 바 + `○○님에게 답글 ✕` 칩).
  어댑터 `CommentThreadAdapter { listKey, enabled, list, replies, create, remove, onCountChange }` 로 밑줄·리뷰 공용.
  캐시는 무효화 대신 패치: 최상위 작성 append·대상 +1 / 답글 작성 replies append·부모 replyCount +1·펼침·대상 +1 /
  최상위 삭제 −(1+답글 수) / 답글 삭제 −1. `src/api/commentCache.ts`(도메인 무관), `src/api/reviewCache.ts`
  (`reviewKey`, `reviewCommentsKey`, `bookReviewsKey=['reviews','book',id]`, `patchReviewEverywhere`).
- **밑줄 상세** `app/quote/[id].tsx`: 카드·나도 그럼·밑줄 삭제만 남기고 댓글은 공용 스레드(겉모습 D1 그대로).
- **리뷰 상세** `app/review/[id].tsx`(신규): `SubHeader "리뷰"` + `ReviewCard`(QuoteCard 구조 미러 — 작성자·책 제목·
  상대 시각·검증 pill·★·세리프 전문·태그·`댓글 N`·`책 보기 →`) + 공용 스레드. 책 제목은 `['book', id]` 재사용.
- **도서 상세**: 리뷰 조각 `ReviewScrap`(Pressable → `/review/{id}`, 본문 2줄, 메타 `검증 라벨 · 댓글 N`);
  밑줄 조각 `QuoteScrap` 은 문장 + `N쪽` 만. 리뷰 목록 키 `bookReviewsKey`.
- `_layout.tsx` 에 `review/[id]`('리뷰') 등록.

## 검증

- 백엔드 `mvnw test` + :8095 스모크(최상위만/답글 포함 카운트/CASCADE/400/라우팅/OpenAPI).
- 앱 `npm run typecheck` + Playwright 워크스루(기존 밑줄 회귀 + 리뷰 상세·답글 접기/펼치기·삭제 카운트) + 스크린샷.
