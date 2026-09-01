# 도서 좋아요 · 상세 빠른 추가 — 설계 문서

2026-09-01 · 브레인스토밍 세션에서 사용자와 함께 결정
전제: [도서 상세 스펙](2026-09-01-book-detail-redesign-design.md) — 이 스펙은 그중
"담기 CTA 넣지 않음" 결정을 **뒤집는다**(사용자 결정).

## 목표

도서 상세에서 바로 행동할 수 있게 한다: 좋아요(신규 기능), 읽고 싶은 담기, 읽기 시작.
좋아요는 서재와 무관한 가벼운 반응으로 백엔드에 신설한다.

## 백엔드 (project-bookey-backend)

- **V6 마이그레이션** `book_likes`: `id BIGSERIAL PK`, `user_id BIGINT NOT NULL REFERENCES
  users(id) ON DELETE CASCADE`, `book_id BIGINT NOT NULL REFERENCES books(id)`,
  `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `UNIQUE (user_id, book_id)`,
  `INDEX (book_id)`.
- **도메인**: `domain/like/BookLike`(엔티티) + `BookLikeRepository`
  (`findByUserIdAndBookId`, `countByBookId`).
- **API** (`api/book`에 추가):
  - `POST /api/v1/books/{bookId}/like` — **토글**. 있으면 삭제, 없으면 생성.
    응답 `BookLikeView { liked: boolean, likeCount: long }` (USER 인증).
  - `BookDetail` 응답에 `liked: boolean`, `likeCount: long` 추가 — 상세 진입 시 별도
    호출 불필요. (스키마 이름·필드는 앱 코드젠 계약 — 확정 후 변경 금지)
- 책 존재 검증: 없으면 `BOOK_NOT_FOUND`. 테스트: 토글 로직이 리포지토리 결합이라 순수
  단위 테스트 대상 없음 — 기동 스모크로 라우트·집계 확인(저장소 테스트 관례).

## 앱 (project-bookey-app)

- 타입 재생성(`npm run types`) 후: `endpoints.ts`에 `bookApi.like(bookId)` 추가
  (`api<BookLikeView>('/api/v1/books/${bookId}/like', { method: 'POST' })`),
  `types.ts`에 `BookLikeView` 별칭. `bookApi.detail`의 손글씨 반환 타입
  `{ book, description }`을 생성 `BookDetail` 별칭으로 교체해 새 필드를 받는다.
- **도서 상세 액션 바** — 히어로 바로 아래 가로 배치:
  - **♥ 좋아요 (N)** — 항상 표시. `book.detail`의 `liked`/`likeCount`로 초기 상태,
    탭 → `bookApi.like` 토글 → 응답으로 상태·카운트 갱신(`['book', bookId]` invalidate).
    liked = `accent` 채움(♥), 아니면 `lineStrong` 아웃라인(♡). pending 중 비활성.
  - **+ 읽고 싶은** / **▶ 읽기 시작** — 서재에 없을 때만(record 없음). 탭 →
    `libraryApi.add({ bookId, status })` (WANT_TO_READ | READING) → 성공 응답의
    `record.id`를 로컬 상태로 채택해 **그 자리에서 진척 카드 모드로 전환**
    (rid 기반 쿼리들이 즉시 활성화). `['library']` invalidate.
  - 이미 담긴 책(record 있음): 두 담기 버튼 대신 기존 진척 카드. 좋아요 버튼은 유지.
  - 실패: 해당 버튼 아래 warn 캡션 "처리하지 못했어요 · 다시 시도" (기존 문법).

## 검증

- 백엔드: `./mvnw test` 회귀 + 기동 스모크(토글 401→인증 시 liked/likeCount 반전,
  OpenAPI에 BookLikeView 노출).
- 앱: `npm run typecheck` + 웹 육안(좋아요 토글·카운트, 읽고 싶은/읽기 시작 → 진척 카드
  즉시 전환, 서재 반영).
