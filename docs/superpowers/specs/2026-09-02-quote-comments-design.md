# 밑줄 댓글 · 도서별 밑줄 — 설계 문서

2026-09-02 · 브레인스토밍 세션에서 사용자와 함께 결정
전제: [콜라주 리디자인 스펙](2026-09-01-collage-redesign-design.md)의 광장(밑줄 피드)과
백엔드 계획 `project-bookey-backend/docs/superpowers/plans/2026-09-01-quotes-plaza.md`.
그 계획에서 백로그로 잘라 둔 "덧붙임(답글)"을 이 스펙이 구현한다.

## 목표

1. 광장의 밑줄 카드를 눌러 **밑줄 상세**로 들어가고, 거기서 **댓글**을 남긴다.
2. **도서 상세**의 리뷰 섹션에서 그 책에 달린 밑줄을 바로 본다(리뷰 | 밑줄 탭).

## 범위 밖

댓글의 답글(중첩) · 댓글 수정 · 알림 · 신고/모더레이션 · 밑줄 작성자가 남의 댓글 삭제 ·
홈 '오려둔 문장' 스포트라이트·프로필 내 밑줄 목록에서의 상세 진입(후속 작업).

## 백엔드 (project-bookey-backend, 브랜치 `feature/quote-comments`)

### V9 마이그레이션 `quote_comments`

```sql
CREATE TABLE quote_comments (
    id         BIGSERIAL PRIMARY KEY,
    quote_id   BIGINT NOT NULL REFERENCES book_quotes(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       VARCHAR(300) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_comments_quote ON quote_comments(quote_id, created_at, id);
```

댓글 수는 카운터 컬럼 없이 `quote_id` 그룹 카운트로 집계한다(나도 그럼 `countPerQuote`와
같은 방식 — 불일치 위험 없음).

### 도메인 `domain/quote`

- `QuoteComment` 엔티티(`BaseTimeEntity`): `id · quoteId · userId · body(300)`,
  `isOwnedBy(userId)`.
- `QuoteCommentRepository`:
  `findAllByQuoteIdOrderByCreatedAtAscIdAsc(quoteId, pageable)` ·
  `countByQuoteId(quoteId)` · `countPerQuote(quoteIds)` (프로젝션 `CommentCount { quoteId, commentCount }`).

### API (`api/quote`)

새 컨트롤러 `QuoteCommentController`(`/api/v1/quotes/{quoteId}/comments`) + `QuoteCommentService`.
기존 `QuoteController`에 단건 조회 추가. 전부 USER 인증.

| 메서드 | 경로 | 동작 | 응답 |
|---|---|---|---|
| GET | `/api/v1/quotes/{quoteId}` | 밑줄 한 건(상세 진입·새로고침·딥링크) | `BookQuoteView` |
| GET | `/api/v1/quotes/{quoteId}/comments?page&size` | 댓글 목록 **오래된 순** | `PageResponse<QuoteCommentView>` |
| POST | `/api/v1/quotes/{quoteId}/comments` | 댓글 작성. 도배 제한 `quote:comment:{userId}` 1분 20건 | `QuoteCommentView` |
| DELETE | `/api/v1/quotes/{quoteId}/comments/{commentId}` | 본인 댓글 삭제 | 204 |

- 요청 `CreateQuoteCommentRequest { @NotBlank @Size(max=300) body }`.
- 응답 `QuoteCommentView { id, quoteId, authorId, authorNickname, authorAvatarUrl?, body, mine, createdAt }`.
  탈퇴 작성자는 닉네임 "알 수 없음"(밑줄과 동일). 스키마 이름·필드는 앱 코드젠 계약 — 확정 후 변경 금지.
- 기존 응답에 필드 **추가**(호환 유지):
  `BookQuoteView.commentCount: long`(`mine` 다음, `createdAt` 앞) ·
  `PlazaItemView.commentCount: Long`(맨 끝, FINISH 는 null).
  `QuoteService.assembleViews` · `PlazaService.assembleQuoteItems` 가 `Map<Long, Long> commentCounts` 를 받아 결측 0.
- 검증·에러: 밑줄 없음 `QUOTE_NOT_FOUND` · 댓글 없음/다른 밑줄의 댓글 `QUOTE_COMMENT_NOT_FOUND`(신규, 404
  "댓글을 찾을 수 없습니다.") · 남의 댓글 삭제 `FORBIDDEN`.

### 테스트

기존 방식(순수 단위 + 리플렉션 id 주입): `QuoteCommentServiceTest`(조립 매핑 — mine · 탈퇴 작성자
대체), `QuoteServiceTest` · `PlazaServiceTest` 에 `commentCount` 매핑·결측 0 케이스 추가.
`npm test` 전체 통과 후 기동 스모크로 라우트·OpenAPI 노출 확인.

## 앱 (project-bookey-app, 브랜치 `feature/quote-comments`)

### 계약 갱신

`npm run types` 재생성 후 `types.ts` 별칭 `QuoteComment = Schemas['QuoteCommentView']`,
`CreateQuoteComment = Schemas['CreateQuoteCommentRequest']`. `endpoints.ts` `quoteApi` 에
`get(quoteId)` · `byBook(bookId, page, size)`(기존 서버 API 래핑) · `comments(quoteId, page, size)` ·
`addComment(quoteId, body)` · `removeComment(quoteId, commentId)` 추가.

### 공용 캐시 모듈 `src/api/quoteCache.ts`

같은 밑줄이 광장 무한 피드 · 홈 스포트라이트 · 책별 목록 · 상세 네 곳의 캐시에 있으므로
키와 패치를 한 곳에 둔다. plaza.tsx 안의 `feedKey`/`HOME_KEY`/`toggleAgree`/`patchQuote` 를
여기로 옮기고 plaza 는 import 로 바꾼다.

- 키: `plazaFeedKey(type)` = `['plaza', type]` · `PLAZA_HOME_KEY` = `['plaza','QUOTE','home']` ·
  `bookQuotesKey(bookId)` = `['quotes','book', bookId]` · `quoteKey(quoteId)` = `['quote', quoteId]`.
  (`['quotes', ...]` 접두는 기존 '내 밑줄' 무효화와 같은 뿌리라 `invalidateQueries(['quotes'])` 가 함께 잡는다.)
- `patchQuoteEverywhere(queryClient, quoteId, patch: { agreedByMe?, agreeCount?, commentCount? })`:
  `PlazaItem`(식별자 `quoteId`)과 `BookQuote`(식별자 `id`) 양쪽 모양을 알고 네 캐시를 한 번에 손본다.
  `toggleAgreePatch(item)` 은 항목 자신의 현재값을 뒤집는다(기존 규칙 유지).
- `invalidateQuoteLists(queryClient)`: `['plaza']` · `['quotes']` 무효화(밑줄 삭제·작성 뒤).

### 공용 카드 `src/components/quote/QuoteCard.tsx`

광장 카드와 상세 상단 카드가 같은 카드 가족(D1)이므로 하나로 뺀다. props 는 화면 모양에 필요한
값만(작성자 닉네임·아바타 · 책 제목 · 쪽 · 문장 · agreeCount · agreedByMe · commentCount · mine ·
confirming · error) + 핸들러(`onAgree` · `onDelete?` · `onOpen?` · `onOpenBook?`). 푸터는
"나도 그럼 N" · "댓글 N" · (mine) "삭제 / 한 번 더" 순. `onOpen` 이 있으면 문장 본문이 Pressable
(accessibilityRole="button", "밑줄 상세"). 상세에서는 `onOpen` 없이 "책 보기 →" 를 푸터 오른쪽에.
plaza.tsx 의 `FeedCard` 는 QUOTE 항목을 `QuoteCard` 로 그리고 FINISH 분기만 남긴다.

### 밑줄 상세 `app/quote/[id].tsx` (D1)

- `_layout.tsx` 에 `<Stack.Screen name="quote/[id]" options={{ title: '밑줄' }} />`.
- `PaperScreen` + `SubHeader category="밑줄"`. 본문은 `KeyboardAvoidingView`(토론 화면과 같은
  방식·오프셋) 안의 `FlatList`: 헤더 = `QuoteCard`, 항목 = 댓글 행, 푸터 = `hasNextPage` 일 때
  가운데 모노 링크 **"댓글 더 보기 →"**(오래된 순이므로 다음 페이지가 더 새 댓글). 하단 고정 입력 바.
- 데이터: `useQuery(quoteKey(id), quoteApi.get)` · `useInfiniteQuery(['quote', id, 'comments'], size 30)`.
- 댓글 행: 24px 아바타(이니셜 폴백) · 닉네임(bodyStrong 12) · 본문(body 13/1.55, textMuted 톤) ·
  모노 캡션 `formatRelative(createdAt)` · mine 이면 "삭제"(첫 탭 "한 번 더", 3초 뒤 접힘 — 광장과 동일).
- 입력 바: `TextInput`(multiline, maxLength 300, placeholder "이 문장에 덧붙이기…") + 알약 "남기기"
  (accent, 빈 값/전송 중 비활성 0.35). 성공 시 입력 비우고 댓글 목록 무효화 + `patchQuoteEverywhere(commentCount+1)`.
  실패 시 입력 아래 warn 캡션(ApiError 메시지 또는 "남기지 못했어요 · 다시 시도").
- 댓글 삭제 성공: 목록 무효화 + `commentCount-1`. 밑줄 삭제(본인): `invalidateQuoteLists` 후 `router.back()`.
- 나도 그럼: 광장과 같은 낙관 토글 + 인플라이트 가드(quote 단위 Set), 캐시 패치는 공용 모듈.
- 상태: 로딩 스켈레톤(카드 1장 높이) · 밑줄 404/실패 `EmptyState("밑줄을 불러오지 못했습니다")` ·
  댓글 0건 "아직 덧붙인 말이 없어요. 첫 마디를 남겨보세요." · 댓글 로드 실패 재시도 링크.

### 광장 `app/plaza.tsx`

- QUOTE 카드 → `QuoteCard`(`onOpen` = `router.push('/quote/${quoteId}')`, `commentCount` 표시).
- 나도 그럼/삭제 뮤테이션은 그대로, 캐시 도우미만 `quoteCache` 에서 import.

### 도서 상세 `app/book/[id].tsx` — 리뷰 섹션 (A1)

- `ReviewSection` 을 탭 두 개짜리 섹션으로: 상태 `tab: 'REVIEW' | 'QUOTE'`(기본 REVIEW).
  헤더는 `SectionHeader` 대신 새 `TabbedSectionHeader`(같은 파일 내부 컴포넌트): 명조 18px 제목 두 개
  "리뷰" · "밑줄"(간격 18) — 활성은 `text`, 비활성 `textFaint`, 활성 아래 22×2 accent 밑줄 토막.
  **개수는 표기하지 않는다.** 우측 액션은 탭별: REVIEW = 기존 "쓰기 →", QUOTE = "오려두기 →"
  (`rid != null` 일 때만). 탭을 바꾸면 펼쳐져 있던 작성 폼(리뷰든 오려두기든)은 닫힌다.
- QUOTE 탭 본문 `BookQuotesTab`(`src/components/book/BookQuotesTab.tsx`):
  `useInfiniteQuery(bookQuotesKey(bookId), quoteApi.byBook(bookId, page, 5))`.
  각 항목은 점선 `MemoScrap`(zigzag ±1°) 안에 문장(명조 14/1.7, 왼쪽 accent 2px 선) + 모노 메타
  "닉네임 · N쪽 · 나도 그럼 N · 댓글 N"(댓글은 accent). 조각 전체가 Pressable → `/quote/[id]`.
  `hasNextPage` 면 가운데 모노 링크 "밑줄 더 보기 →" 로 다음 페이지. 0건 "아직 이 책에 밑줄이 없어요.
  읽다가 걸린 문장을 오려두세요." · 실패 "밑줄을 불러오지 못했습니다" + 재시도.
- 오려두기 인라인 폼(리뷰 폼과 같은 `Card` 펼침): 문장 `TextInput`(명조, 500자) + 쪽수(선택, 1 이상
  정수) + "오려두기" 알약. 책 고르기 없음 — `quoteApi.create({ bookId, readingRecordId: rid, content, page })`.
  성공 시 폼 닫고 `invalidateQuoteLists`(책별 목록은 `['quotes']` 뿌리라 함께 갱신). 실패 warn 캡션.
  `rid` 가 없으면 액션 자체를 숨긴다(리뷰 "쓰기 →" 와 같은 규칙).

### 접근성·모션

- 모든 Pressable 에 `accessibilityRole="button"` + 라벨. 10px 모노 라벨은 광장의 `footAction`
  여백(36px 상자) 규칙 그대로.
- 탭 전환·댓글 추가는 애니메이션 없이 즉시(리스트 안정성 우선).

## 검증

- 백엔드: `npm test`(전체) → `npm run dev` 기동 스모크: 401 확인, 댓글 작성→목록 오래된 순→삭제 204,
  남의 댓글 403, 없는 댓글 404, OpenAPI 에 `QuoteCommentView` · `commentCount` 노출.
- 앱: `npm run types` → `npm run typecheck` 0 → 웹(`npm run web`) 육안: 광장 카드 "댓글 N"·탭→상세,
  댓글 작성/삭제 후 카운트가 광장·도서 상세에 반영, 나도 그럼이 상세↔광장 동기, 도서 상세 탭 전환·
  오려두기 인라인 폼·더 보기, 라이트 모드 색.
- 완료 후 두 저장소 모두 main 머지 → `feature/quote-comments` 삭제.
