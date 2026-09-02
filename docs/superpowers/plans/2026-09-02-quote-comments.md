# 밑줄 댓글 · 도서별 밑줄 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 광장 밑줄 카드에서 밑줄 상세로 들어가 댓글을 달고, 도서 상세 리뷰 섹션의 "밑줄" 탭에서 그 책의 밑줄을 본다.

**Architecture:** 백엔드는 `quote_comments` 테이블(V9) + `QuoteCommentService/Controller` 를 `api/quote` 에 더하고, 기존 `BookQuoteView`/`PlazaItemView` 에 `commentCount` 를 추가한다(카운트 쿼리 집계). 앱은 밑줄 캐시 4곳(광장 피드·홈 스포트라이트·책별 목록·상세)의 키와 패치를 `src/api/quoteCache.ts` 한 곳에 모으고, 광장 카드를 `QuoteCard` 로 빼서 광장·상세가 같은 카드를 쓴다. 새 화면 `app/quote/[id].tsx`, 도서 상세는 `ReviewSection` 을 리뷰|밑줄 탭으로 바꾸고 `BookQuotesTab` 을 붙인다.

**Tech Stack:** Spring Boot 4.1 / Java 21 / Flyway / JPA (백엔드) · Expo + expo-router + TanStack Query v5 + TypeScript strict (앱)

**Spec:** `docs/superpowers/specs/2026-09-02-quote-comments-design.md`

## Global Constraints

- 두 저장소 모두 격리 worktree 브랜치 `feature/quote-comments` 에서 작업한다.
  - 앱: `D:/Develop/workspace/myproject/project-bookey-app/.claude/worktrees/quote-comments` (이 세션의 cwd)
  - 백엔드: `D:/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments` (아래 `<BE>`)
- **백엔드 Maven 은 반드시 JDK 21 로**: 모든 `./mvnw` 앞에 `JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7"` (기본 JAVA_HOME 은 JDK 8 — 문법 에러처럼 실패한다).
- 이 세션의 Bash 는 worktree 격리 검사 때문에 **쉘 변수로 만든 경로**(`$B/...`)를 거부한다. 경로는 항상 리터럴로 쓴다.
- 커밋 메시지: 한국어, 첫 줄 `신규:`/`수정:` 접두. AI 어트리뷰션(Co-Authored-By 등) 절대 금지. 커밋 직전 `git branch --show-current` 로 `feature/quote-comments` 확인.
- 코드 주석·UI 문구·`@Operation(summary)`·`@DisplayName`·에러 메시지는 한국어.
- 앱은 `@/api/types`·`@/api/endpoints` 만 import. 서버 필드를 손으로 적지 않는다 — 타입은 `npm run types` 로 재생성.
- 색은 `useTheme()` 의 `colors` 로만, 폰트·간격·반경은 `@/theme` 토큰만. 새 literal 금지.
- 응답 DTO 는 자바 record. 스키마 이름 `QuoteCommentView` · `CreateQuoteCommentRequest` 확정(변경 금지).
- 댓글 본문 300자 · 도배 제한 `quote:comment:{userId}` 1분 20건 · 목록 오래된 순 · 본인만 삭제.
- 포트: 기존 dev 서버(main 트리, :8080)는 건드리지 않는다. 이 브랜치 서버는 **`SERVER_PORT=8090`** 으로 띄우고, 앱은 `BOOKEY_API_URL=http://localhost:8090 npm run types` · `EXPO_PUBLIC_API_URL=http://localhost:8090 npm run web` 으로 그 서버를 본다.

---

## 파일 구조

**백엔드 (`<BE>/server/src`)**

| 파일 | 역할 |
|---|---|
| `main/resources/db/migration/V9__quote_comments.sql` | 신규. 댓글 테이블 |
| `main/java/app/bookey/domain/quote/QuoteComment.java` | 신규. 엔티티 |
| `main/java/app/bookey/domain/quote/QuoteCommentRepository.java` | 신규. 목록·카운트 집계 |
| `main/java/app/bookey/api/quote/dto/QuoteDtos.java` | 수정. `commentCount` · 댓글 DTO 2종 |
| `main/java/app/bookey/api/plaza/dto/PlazaDtos.java` | 수정. `commentCount` |
| `main/java/app/bookey/api/quote/QuoteService.java` | 수정. `get` · commentCounts 조립 |
| `main/java/app/bookey/api/plaza/PlazaService.java` | 수정. commentCounts 조립 |
| `main/java/app/bookey/api/quote/QuoteController.java` | 수정. `GET /{quoteId}` |
| `main/java/app/bookey/api/quote/QuoteCommentService.java` | 신규. 목록·작성·삭제 |
| `main/java/app/bookey/api/quote/QuoteCommentController.java` | 신규. 댓글 API 3종 |
| `main/java/app/bookey/common/error/ErrorCode.java` | 수정. `QUOTE_COMMENT_NOT_FOUND` |
| `test/java/app/bookey/domain/quote/QuoteCommentTest.java` | 신규 |
| `test/java/app/bookey/api/quote/QuoteCommentServiceTest.java` | 신규 |
| `test/java/app/bookey/api/quote/QuoteServiceTest.java` · `test/java/app/bookey/api/plaza/PlazaServiceTest.java` | 수정. 인자 추가 + commentCount 케이스 |

**앱 (worktree 루트)**

| 파일 | 역할 |
|---|---|
| `src/api/generated.ts` | 재생성 |
| `src/api/types.ts` · `src/api/endpoints.ts` | 별칭 2개 · `quoteApi` 5개 |
| `src/api/quoteCache.ts` | 신규. 밑줄 캐시 키·패치·무효화 |
| `src/components/quote/useAgreeQuote.ts` | 신규. 나도 그럼 낙관 토글 훅(광장·상세 공용) |
| `src/components/quote/QuoteCard.tsx` | 신규. 밑줄 카드(광장·상세 공용) |
| `app/plaza.tsx` | 수정. 캐시 도우미·카드 교체, 상세 진입 |
| `app/quote/[id].tsx` | 신규. 밑줄 상세 + 댓글 |
| `app/_layout.tsx` | 수정. 화면 등록 |
| `src/components/book/BookQuotesTab.tsx` | 신규. 도서 상세 밑줄 탭 + 인라인 오려두기 |
| `app/book/[id].tsx` | 수정. `ReviewSection` 을 탭 섹션으로 |

---

## Task B1: 댓글 테이블·엔티티·리포지토리

**Files:**
- Create: `<BE>/server/src/main/resources/db/migration/V9__quote_comments.sql`
- Create: `<BE>/server/src/main/java/app/bookey/domain/quote/QuoteComment.java`
- Create: `<BE>/server/src/main/java/app/bookey/domain/quote/QuoteCommentRepository.java`
- Test: `<BE>/server/src/test/java/app/bookey/domain/quote/QuoteCommentTest.java`

**Interfaces:**
- Produces: `QuoteComment.builder().quoteId(Long).userId(Long).body(String)`, `isOwnedBy(Long)`, `belongsTo(Long)`;
  `QuoteCommentRepository.findAllByQuoteIdOrderByCreatedAtAscIdAsc(Long, Pageable)`, `countByQuoteId(Long)`,
  `countPerQuote(Collection<Long>) -> List<CommentCount{getQuoteId(), getCommentCount()}>`.

- [ ] **Step 1: 실패하는 도메인 테스트 작성**

`<BE>/server/src/test/java/app/bookey/domain/quote/QuoteCommentTest.java`:

```java
package app.bookey.domain.quote;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class QuoteCommentTest {

    private QuoteComment comment(Long quoteId, Long userId) {
        return QuoteComment.builder().quoteId(quoteId).userId(userId).body("덧붙임").build();
    }

    @Test
    @DisplayName("작성자 본인이면 true, 아니면 false를 반환한다")
    void isOwnedByChecksAuthor() {
        QuoteComment comment = comment(1L, 10L);

        assertThat(comment.isOwnedBy(10L)).isTrue();
        assertThat(comment.isOwnedBy(99L)).isFalse();
    }

    @Test
    @DisplayName("경로의 밑줄에 달린 댓글인지 확인한다")
    void belongsToChecksQuote() {
        QuoteComment comment = comment(1L, 10L);

        assertThat(comment.belongsTo(1L)).isTrue();
        assertThat(comment.belongsTo(2L)).isFalse();
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments/server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q test -Dtest=QuoteCommentTest 2>&1 | tail -15`
Expected: 컴파일 에러 `cannot find symbol ... QuoteComment`

- [ ] **Step 3: 마이그레이션·엔티티·리포지토리 작성**

`<BE>/server/src/main/resources/db/migration/V9__quote_comments.sql`:

```sql
-- 밑줄에 덧붙인 말(댓글). 설계: project-bookey-app/docs/superpowers/specs/2026-09-02-quote-comments-design.md
CREATE TABLE quote_comments (
    id         BIGSERIAL PRIMARY KEY,
    quote_id   BIGINT NOT NULL REFERENCES book_quotes(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       VARCHAR(300) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 목록은 오래된 순 — 같은 시각이면 id 로 안정 정렬한다.
CREATE INDEX idx_quote_comments_quote ON quote_comments(quote_id, created_at, id);
```

`<BE>/server/src/main/java/app/bookey/domain/quote/QuoteComment.java`:

```java
package app.bookey.domain.quote;

import app.bookey.common.support.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 밑줄에 덧붙인 말(댓글) — 평면 구조, 본인만 삭제한다. */
@Getter
@Entity
@Table(name = "quote_comments")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuoteComment extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "quote_id", nullable = false)
    private Long quoteId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 300)
    private String body;

    @Builder
    private QuoteComment(Long quoteId, Long userId, String body) {
        this.quoteId = quoteId;
        this.userId = userId;
        this.body = body;
    }

    public boolean isOwnedBy(Long userId) {
        return this.userId.equals(userId);
    }

    /** 경로의 밑줄과 댓글의 밑줄이 같은지 — 다른 밑줄 경로로 남의 댓글을 지우는 것을 막는다. */
    public boolean belongsTo(Long quoteId) {
        return this.quoteId.equals(quoteId);
    }
}
```

`<BE>/server/src/main/java/app/bookey/domain/quote/QuoteCommentRepository.java`:

```java
package app.bookey.domain.quote;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface QuoteCommentRepository extends JpaRepository<QuoteComment, Long> {

    /** 밑줄 하나의 댓글 — 오래된 순(대화 흐름). */
    Page<QuoteComment> findAllByQuoteIdOrderByCreatedAtAscIdAsc(Long quoteId, Pageable pageable);

    long countByQuoteId(Long quoteId);

    /** 문장별 댓글 수 — 목록 배치 로딩용 GROUP BY 프로젝션(QuoteAgreeRepository.countPerQuote 미러). */
    @Query("""
            SELECT c.quoteId AS quoteId, COUNT(c) AS commentCount
            FROM QuoteComment c
            WHERE c.quoteId IN :quoteIds
            GROUP BY c.quoteId
            """)
    List<CommentCount> countPerQuote(@Param("quoteIds") Collection<Long> quoteIds);

    interface CommentCount {
        Long getQuoteId();
        long getCommentCount();
    }
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments/server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw test -Dtest=QuoteCommentTest 2>&1 | grep -E "Tests run|BUILD"`
Expected: `Tests run: 2, Failures: 0, Errors: 0` · `BUILD SUCCESS`

- [ ] **Step 5: 커밋**

```bash
cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments && git branch --show-current && git add server/src/main/resources/db/migration/V9__quote_comments.sql server/src/main/java/app/bookey/domain/quote/QuoteComment.java server/src/main/java/app/bookey/domain/quote/QuoteCommentRepository.java server/src/test/java/app/bookey/domain/quote/QuoteCommentTest.java && git commit -q -m "신규: 밑줄 댓글 도메인 — quote_comments(V9)·엔티티·리포지토리" && git log --oneline -1
```

---

## Task B2: `commentCount` 필드 + 밑줄 단건 조회

**Files:**
- Modify: `<BE>/server/src/main/java/app/bookey/api/quote/dto/QuoteDtos.java`
- Modify: `<BE>/server/src/main/java/app/bookey/api/plaza/dto/PlazaDtos.java`
- Modify: `<BE>/server/src/main/java/app/bookey/api/quote/QuoteService.java`
- Modify: `<BE>/server/src/main/java/app/bookey/api/plaza/PlazaService.java`
- Modify: `<BE>/server/src/main/java/app/bookey/api/quote/QuoteController.java`
- Test: `<BE>/server/src/test/java/app/bookey/api/quote/QuoteServiceTest.java`, `<BE>/server/src/test/java/app/bookey/api/plaza/PlazaServiceTest.java`

**Interfaces:**
- Consumes: `QuoteCommentRepository.countPerQuote` (B1)
- Produces: `BookQuoteView(..., boolean mine, long commentCount, Instant createdAt)` ·
  `PlazaItemView(..., Boolean agreedByMe, Long commentCount)` ·
  `QuoteService.get(Long userId, Long quoteId) -> BookQuoteView` ·
  `QuoteService.assembleViews(quotes, viewerId, books, authors, agreeCounts, myAgreed, commentCounts)` ·
  `PlazaService.assembleQuoteItems(quotes, books, authors, agreeCounts, myAgreed, commentCounts)` ·
  `GET /api/v1/quotes/{quoteId}`

- [ ] **Step 1: 기존 테스트 호출에 인자 추가 + 실패하는 commentCount 테스트 추가**

기존 호출 끝을 sed 로 한 번에 바꾼다(두 파일 모두 `assembleViews`/`assembleQuoteItems` 의 마지막 인자가 `myAgreed)` 또는 `Set.of())` 로 끝난다):

```bash
cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments/server/src/test/java/app/bookey/api && sed -i 's/agreeCounts, myAgreed);/agreeCounts, myAgreed, Map.of());/; s/Map.of(), Set.of());/Map.of(), Set.of(), Map.of());/' quote/QuoteServiceTest.java plaza/PlazaServiceTest.java && grep -c "Map.of());" quote/QuoteServiceTest.java plaza/PlazaServiceTest.java
```
Expected: `quote/QuoteServiceTest.java:4` · `plaza/PlazaServiceTest.java:5`

`QuoteServiceTest.java` 의 마지막 테스트(`preservesInputOrder`) 뒤, 클래스 닫는 `}` 앞에 추가:

```java
    @Test
    @DisplayName("commentCount를 배치 맵으로 매핑하고, 없으면 0이다")
    void mapsCommentCount() {
        BookQuote withComments = quote(1L, 10L, 100L);
        BookQuote without = quote(2L, 10L, 100L);
        Map<Long, Book> books = Map.of(100L, book(100L, "책"));
        Map<Long, User> authors = Map.of(10L, user(10L, "작가"));

        List<BookQuoteView> views = QuoteService.assembleViews(
                List.of(withComments, without), 10L, books, authors, Map.of(), Set.of(), Map.of(1L, 4L));

        assertThat(views.get(0).commentCount()).isEqualTo(4L);
        assertThat(views.get(1).commentCount()).isZero();
    }
```

`PlazaServiceTest.java` 의 `assembleQuoteItemsFiltersRowsWithMissingBook` 뒤에 추가:

```java
    @Test
    @DisplayName("assembleQuoteItems: commentCount를 배치 맵으로 매핑하고, 없으면 0이다")
    void assembleQuoteItemsMapsCommentCount() {
        BookQuote withComments = quote(1L, 10L, 100L);
        BookQuote without = quote(2L, 10L, 100L);
        Map<Long, Book> books = Map.of(100L, book(100L, "책"));
        Map<Long, User> authors = Map.of(10L, user(10L, "작가"));

        List<PlazaItemView> items = PlazaService.assembleQuoteItems(
                List.of(withComments, without), books, authors, Map.of(), Set.of(), Map.of(1L, 2L));

        assertThat(items.get(0).commentCount()).isEqualTo(2L);
        assertThat(items.get(1).commentCount()).isZero();
    }
```

그리고 `assembleFinishItemsOccurredAtIsFinishedAtAndQuoteFieldsAreNull` 의 마지막 단언 `assertThat(item.agreedByMe()).isNull();` 아래에 한 줄 추가:

```java
        assertThat(item.commentCount()).isNull();
```

- [ ] **Step 2: 실패 확인**

Run: `cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments/server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q test -Dtest='QuoteServiceTest,PlazaServiceTest' 2>&1 | tail -15`
Expected: 컴파일 에러(인자 개수 불일치 / `commentCount()` 없음)

- [ ] **Step 3: DTO 수정**

`QuoteDtos.java` 의 `BookQuoteView` 를 아래로 교체(`mine` 다음에 `commentCount`):

```java
    public record BookQuoteView(@NotNull Long id, @NotNull Long bookId, @NotNull String bookTitle,
            String bookCoverUrl, Integer page, @NotNull String content,
            @NotNull Long authorId, @NotNull String authorNickname, String authorAvatarUrl,
            long agreeCount, boolean agreedByMe, boolean mine, long commentCount,
            @NotNull Instant createdAt) {}
```

`PlazaDtos.java` 의 `PlazaItemView` 를 아래로 교체(맨 끝 `commentCount`, FINISH 는 null):

```java
    /** 광장 피드 아이템 — QUOTE 전용 필드는 FINISH 아이템에서 전부 null이다. */
    public record PlazaItemView(
            @NotNull PlazaItemType type,
            @NotNull Long authorId, @NotNull String authorNickname, String authorAvatarUrl,
            @NotNull Long bookId, @NotNull String bookTitle, String bookCoverUrl,
            @NotNull Instant occurredAt,
            Long quoteId, String content, Integer page, Long agreeCount, Boolean agreedByMe,
            Long commentCount) {}
```

- [ ] **Step 4: QuoteService 수정**

`QuoteService.java` 에서:

(a) import 두 줄 추가(기존 `QuoteAgreeRepository.AgreeCount` import 아래):
```java
import app.bookey.domain.quote.QuoteCommentRepository;
import app.bookey.domain.quote.QuoteCommentRepository.CommentCount;
```

(b) 필드 추가(`agreeRepository` 아래):
```java
    private final QuoteCommentRepository commentRepository;
```

(c) `create` 의 `assembleViews(...)` 호출을 아래로 교체:
```java
        List<BookQuoteView> views = assembleViews(List.of(quote), userId,
                Map.of(book.getId(), book),
                author == null ? Map.of() : Map.of(userId, author),
                Map.of(), Set.of(), Map.of());
```

(d) `myQuotes` 위에 단건 조회 추가:
```java
    /** 밑줄 한 건 — 상세 진입·새로고침·딥링크. */
    @Transactional(readOnly = true)
    public BookQuoteView get(Long userId, Long quoteId) {
        List<BookQuote> quotes = List.of(getQuote(quoteId));
        return assembleViews(quotes, userId,
                loadBooks(quotes, Map.of()), loadAuthors(quotes),
                loadAgreeCounts(quotes), loadMyAgreed(userId, quotes), loadCommentCounts(quotes)).get(0);
    }
```

(e) `toPageResponse` 본문을 아래로 교체:
```java
        List<BookQuote> quotes = page.getContent();
        Map<Long, Book> books = loadBooks(quotes, knownBooks);
        Map<Long, User> authors = loadAuthors(quotes);
        Map<Long, Long> agreeCounts = loadAgreeCounts(quotes);
        Set<Long> myAgreed = loadMyAgreed(userId, quotes);
        Map<Long, Long> commentCounts = loadCommentCounts(quotes);
        List<BookQuoteView> views = assembleViews(quotes, userId, books, authors, agreeCounts, myAgreed, commentCounts);
        return new PageResponse<>(views, page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), page.hasNext());
```

(f) `loadMyAgreed` 아래에 추가:
```java
    private Map<Long, Long> loadCommentCounts(List<BookQuote> quotes) {
        List<Long> ids = quotes.stream().map(BookQuote::getId).toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return commentRepository.countPerQuote(ids).stream()
                .collect(Collectors.toMap(CommentCount::getQuoteId, CommentCount::getCommentCount));
    }
```

(g) `assembleViews` 시그니처와 생성자 호출 교체:
```java
    /**
     * 배치 맵으로 뷰를 조립한다(ClubPostService.loadAuthors·HomeContentAssembler 선례).
     * agreeCount·commentCount는 결측 시 0, 작성자가 탈퇴했으면 "알 수 없음"으로 대체한다.
     */
    static List<BookQuoteView> assembleViews(List<BookQuote> quotes, Long viewerId,
                                             Map<Long, Book> books, Map<Long, User> authors,
                                             Map<Long, Long> agreeCounts, Set<Long> myAgreedQuoteIds,
                                             Map<Long, Long> commentCounts) {
        return quotes.stream()
                .map(quote -> {
                    Book book = books.get(quote.getBookId());
                    User author = authors.get(quote.getUserId());
                    return new BookQuoteView(
                            quote.getId(),
                            quote.getBookId(),
                            book == null ? null : book.getTitle(),
                            book == null ? null : book.getCoverUrl(),
                            quote.getPage(),
                            quote.getContent(),
                            quote.getUserId(),
                            author == null ? "알 수 없음" : author.getNickname(),
                            author == null ? null : author.getAvatarUrl(),
                            agreeCounts.getOrDefault(quote.getId(), 0L),
                            myAgreedQuoteIds.contains(quote.getId()),
                            quote.isOwnedBy(viewerId),
                            commentCounts.getOrDefault(quote.getId(), 0L),
                            quote.getCreatedAt() == null ? Instant.now() : quote.getCreatedAt());
                })
                .toList();
    }
```

- [ ] **Step 5: PlazaService 수정**

(a) import 추가:
```java
import app.bookey.domain.quote.QuoteCommentRepository;
import app.bookey.domain.quote.QuoteCommentRepository.CommentCount;
```

(b) 필드 추가(`agreeRepository` 아래):
```java
    private final QuoteCommentRepository commentRepository;
```

(c) `quoteFeed` 에서 `Set<Long> myAgreed = ...` 다음 두 줄을 교체:
```java
        Map<Long, Long> commentCounts = loadCommentCounts(quotes);
        List<PlazaItemView> items = assembleQuoteItems(quotes, books, authors, agreeCounts, myAgreed, commentCounts);
```

(d) `loadMyAgreed` 아래 추가:
```java
    private Map<Long, Long> loadCommentCounts(List<BookQuote> quotes) {
        List<Long> ids = quotes.stream().map(BookQuote::getId).toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return commentRepository.countPerQuote(ids).stream()
                .collect(Collectors.toMap(CommentCount::getQuoteId, CommentCount::getCommentCount));
    }
```

(e) `assembleQuoteItems` 시그니처에 `Map<Long, Long> commentCounts` 를 마지막 매개변수로 추가하고, 생성자 마지막 인자 `myAgreedQuoteIds.contains(quote.getId())` 뒤에 한 줄 추가:
```java
                            myAgreedQuoteIds.contains(quote.getId()),
                            commentCounts.getOrDefault(quote.getId(), 0L));
```
javadoc 도 `agreeCount·commentCount 결측 0` 으로 갱신.

(f) `assembleFinishItems` 의 `null, null, null, null, null);` 를 `null, null, null, null, null, null);` 로.

- [ ] **Step 6: 컨트롤러에 단건 조회 추가**

`QuoteController.java` 의 `myQuotes` 메서드 아래:
```java
    @Operation(summary = "문장 한 건 — 상세 진입용")
    @GetMapping("/{quoteId}")
    public BookQuoteView get(@AuthenticationPrincipal AuthUser user, @PathVariable Long quoteId) {
        return quoteService.get(user.id(), quoteId);
    }
```

- [ ] **Step 7: 전체 테스트 통과 확인**

Run: `cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments/server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw test 2>&1 | grep -E "Tests run:|BUILD" | tail -3`
Expected: `Tests run: 96, Failures: 0, Errors: 0` (92 + B1 2 + 이 태스크 2) · `BUILD SUCCESS`

- [ ] **Step 8: 커밋**

```bash
cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments && git branch --show-current && git add -A server/src && git commit -q -m "수정: 밑줄·광장 응답에 commentCount 추가, 밑줄 단건 조회 API

- BookQuoteView·PlazaItemView 에 commentCount(카운트 쿼리 집계, 결측 0)
- GET /api/v1/quotes/{quoteId} — 상세 진입·새로고침·딥링크용" && git log --oneline -1
```

---

## Task B3: 댓글 서비스·컨트롤러·에러 코드

**Files:**
- Modify: `<BE>/server/src/main/java/app/bookey/api/quote/dto/QuoteDtos.java`
- Modify: `<BE>/server/src/main/java/app/bookey/common/error/ErrorCode.java`
- Create: `<BE>/server/src/main/java/app/bookey/api/quote/QuoteCommentService.java`
- Create: `<BE>/server/src/main/java/app/bookey/api/quote/QuoteCommentController.java`
- Test: `<BE>/server/src/test/java/app/bookey/api/quote/QuoteCommentServiceTest.java`

**Interfaces:**
- Consumes: `QuoteComment`, `QuoteCommentRepository` (B1)
- Produces: `QuoteCommentView(id, quoteId, authorId, authorNickname, authorAvatarUrl, body, mine, createdAt)` ·
  `CreateQuoteCommentRequest(body)` · `QuoteCommentService.assembleViews(comments, viewerId, authors)` ·
  `GET/POST /api/v1/quotes/{quoteId}/comments` · `DELETE /api/v1/quotes/{quoteId}/comments/{commentId}` ·
  `ErrorCode.QUOTE_COMMENT_NOT_FOUND`

- [ ] **Step 1: 실패하는 서비스 테스트 작성**

`<BE>/server/src/test/java/app/bookey/api/quote/QuoteCommentServiceTest.java`:

```java
package app.bookey.api.quote;

import app.bookey.api.quote.dto.QuoteDtos.QuoteCommentView;
import app.bookey.domain.quote.QuoteComment;
import app.bookey.domain.user.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class QuoteCommentServiceTest {

    private QuoteComment comment(long id, long quoteId, long userId) {
        QuoteComment comment = QuoteComment.builder()
                .quoteId(quoteId).userId(userId).body("덧붙임 " + id)
                .build();
        set(comment, "id", id);
        return comment;
    }

    private User user(long id, String nickname) {
        User user = User.builder().handle("handle" + id).nickname(nickname).build();
        set(user, "id", id);
        return user;
    }

    private void set(Object target, String field, Object value) {
        try {
            Field f = target.getClass().getDeclaredField(field);
            f.setAccessible(true);
            f.set(target, value);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    @DisplayName("작성자·본문·mine을 매핑한다 — 조회자가 작성자면 mine=true")
    void mapsAuthorBodyAndMine() {
        QuoteComment comment = comment(1L, 7L, 10L);
        Map<Long, User> authors = Map.of(10L, user(10L, "작가"));

        List<QuoteCommentView> views = QuoteCommentService.assembleViews(List.of(comment), 10L, authors);

        QuoteCommentView view = views.get(0);
        assertThat(view.id()).isEqualTo(1L);
        assertThat(view.quoteId()).isEqualTo(7L);
        assertThat(view.authorId()).isEqualTo(10L);
        assertThat(view.authorNickname()).isEqualTo("작가");
        assertThat(view.body()).isEqualTo("덧붙임 1");
        assertThat(view.mine()).isTrue();
        assertThat(view.createdAt()).isNotNull(); // 저장 전이라 createdAt 이 없어도 now 로 채운다
    }

    @Test
    @DisplayName("조회자가 작성자와 다르면 mine=false")
    void mineIsFalseForOtherViewer() {
        QuoteComment comment = comment(1L, 7L, 10L);

        List<QuoteCommentView> views = QuoteCommentService.assembleViews(
                List.of(comment), 20L, Map.of(10L, user(10L, "작가")));

        assertThat(views.get(0).mine()).isFalse();
    }

    @Test
    @DisplayName("탈퇴한 작성자는 '알 수 없음'으로 대체한다")
    void withdrawnAuthorFallsBackToUnknown() {
        QuoteComment comment = comment(1L, 7L, 99L);

        List<QuoteCommentView> views = QuoteCommentService.assembleViews(List.of(comment), 1L, Map.of());

        assertThat(views.get(0).authorNickname()).isEqualTo("알 수 없음");
        assertThat(views.get(0).authorAvatarUrl()).isNull();
    }

    @Test
    @DisplayName("입력 순서를 그대로 유지한다")
    void preservesInputOrder() {
        List<QuoteComment> comments = List.of(comment(5L, 7L, 10L), comment(3L, 7L, 10L), comment(9L, 7L, 10L));

        List<QuoteCommentView> views = QuoteCommentService.assembleViews(
                comments, 10L, Map.of(10L, user(10L, "작가")));

        assertThat(views).extracting(QuoteCommentView::id).containsExactly(5L, 3L, 9L);
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments/server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q test -Dtest=QuoteCommentServiceTest 2>&1 | tail -10`
Expected: 컴파일 에러 `cannot find symbol ... QuoteCommentService` / `QuoteCommentView`

- [ ] **Step 3: DTO·에러 코드 추가**

`QuoteDtos.java` 의 `QuoteAgreeView` 아래에 추가:

```java
    public record CreateQuoteCommentRequest(@NotBlank @Size(max = 300) String body) {}

    /** 밑줄에 덧붙인 말(댓글). 탈퇴한 작성자는 "알 수 없음". */
    public record QuoteCommentView(@NotNull Long id, @NotNull Long quoteId,
            @NotNull Long authorId, @NotNull String authorNickname, String authorAvatarUrl,
            @NotNull String body, boolean mine, @NotNull Instant createdAt) {}
```

`ErrorCode.java` 의 마지막 항목을 교체:

```java
    // 오려둔 문장(밑줄)
    QUOTE_NOT_FOUND(HttpStatus.NOT_FOUND, "문장을 찾을 수 없습니다."),
    QUOTE_COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다.");
```

- [ ] **Step 4: 서비스 작성**

`<BE>/server/src/main/java/app/bookey/api/quote/QuoteCommentService.java`:

```java
package app.bookey.api.quote;

import app.bookey.api.quote.dto.QuoteDtos.CreateQuoteCommentRequest;
import app.bookey.api.quote.dto.QuoteDtos.QuoteCommentView;
import app.bookey.common.error.ApiException;
import app.bookey.common.error.ErrorCode;
import app.bookey.common.support.PageResponse;
import app.bookey.common.support.RateLimiter;
import app.bookey.domain.quote.BookQuoteRepository;
import app.bookey.domain.quote.QuoteComment;
import app.bookey.domain.quote.QuoteCommentRepository;
import app.bookey.domain.user.User;
import app.bookey.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** 밑줄에 덧붙인 말(댓글) — 목록(오래된 순) · 작성 · 본인 삭제. */
@Service
@RequiredArgsConstructor
public class QuoteCommentService {

    /** 도배 방지 — 1분에 20건. */
    private static final int CREATE_RATE_LIMIT = 20;

    private final QuoteCommentRepository commentRepository;
    private final BookQuoteRepository quoteRepository;
    private final UserRepository userRepository;
    private final RateLimiter rateLimiter;

    /** 댓글 목록 — 오래된 순. 입력창이 아래에 있으므로 새 댓글이 바로 위에 보인다. */
    @Transactional(readOnly = true)
    public PageResponse<QuoteCommentView> list(Long userId, Long quoteId, Pageable pageable) {
        requireQuote(quoteId);
        Page<QuoteComment> page = commentRepository.findAllByQuoteIdOrderByCreatedAtAscIdAsc(quoteId, pageable);
        List<QuoteComment> comments = page.getContent();
        List<QuoteCommentView> views = assembleViews(comments, userId, loadAuthors(comments));
        return new PageResponse<>(views, page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), page.hasNext());
    }

    @Transactional
    public QuoteCommentView create(Long userId, Long quoteId, CreateQuoteCommentRequest request) {
        requireQuote(quoteId);
        rateLimiter.require("quote:comment:" + userId, CREATE_RATE_LIMIT, Duration.ofMinutes(1));

        QuoteComment comment = commentRepository.save(QuoteComment.builder()
                .quoteId(quoteId)
                .userId(userId)
                .body(request.body().trim())
                .build());

        User author = userRepository.findById(userId).orElse(null);
        return assembleViews(List.of(comment), userId,
                author == null ? Map.of() : Map.of(userId, author)).get(0);
    }

    /** 본인 댓글만 지운다. 경로의 밑줄에 달리지 않은 댓글은 없는 것으로 본다. */
    @Transactional
    public void delete(Long userId, Long quoteId, Long commentId) {
        QuoteComment comment = commentRepository.findById(commentId)
                .filter(found -> found.belongsTo(quoteId))
                .orElseThrow(() -> ApiException.of(ErrorCode.QUOTE_COMMENT_NOT_FOUND));
        if (!comment.isOwnedBy(userId)) {
            throw ApiException.of(ErrorCode.FORBIDDEN);
        }
        commentRepository.delete(comment);
    }

    // ────────────────────────────── 내부 ──────────────────────────────

    private void requireQuote(Long quoteId) {
        if (!quoteRepository.existsById(quoteId)) {
            throw ApiException.of(ErrorCode.QUOTE_NOT_FOUND);
        }
    }

    private Map<Long, User> loadAuthors(List<QuoteComment> comments) {
        List<Long> ids = comments.stream().map(QuoteComment::getUserId).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
    }

    /** 배치 맵으로 뷰를 조립한다(QuoteService.assembleViews 선례). 탈퇴한 작성자는 "알 수 없음". */
    static List<QuoteCommentView> assembleViews(List<QuoteComment> comments, Long viewerId,
                                                Map<Long, User> authors) {
        return comments.stream()
                .map(comment -> {
                    User author = authors.get(comment.getUserId());
                    return new QuoteCommentView(
                            comment.getId(),
                            comment.getQuoteId(),
                            comment.getUserId(),
                            author == null ? "알 수 없음" : author.getNickname(),
                            author == null ? null : author.getAvatarUrl(),
                            comment.getBody(),
                            comment.isOwnedBy(viewerId),
                            comment.getCreatedAt() == null ? Instant.now() : comment.getCreatedAt());
                })
                .toList();
    }
}
```

- [ ] **Step 5: 컨트롤러 작성**

`<BE>/server/src/main/java/app/bookey/api/quote/QuoteCommentController.java`:

```java
package app.bookey.api.quote;

import app.bookey.api.quote.dto.QuoteDtos.CreateQuoteCommentRequest;
import app.bookey.api.quote.dto.QuoteDtos.QuoteCommentView;
import app.bookey.common.security.AuthUser;
import app.bookey.common.support.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "QuoteComment", description = "밑줄에 덧붙인 말(댓글) — 목록 · 작성 · 삭제")
@RestController
@RequestMapping("/api/v1/quotes/{quoteId}/comments")
@RequiredArgsConstructor
public class QuoteCommentController {

    private final QuoteCommentService commentService;

    @Operation(summary = "댓글 목록 — 오래된 순")
    @GetMapping
    public PageResponse<QuoteCommentView> list(@AuthenticationPrincipal AuthUser user,
                                               @PathVariable Long quoteId,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "30") int size) {
        return commentService.list(user.id(), quoteId, PageRequest.of(page, size));
    }

    @Operation(summary = "댓글 작성")
    @PostMapping
    public QuoteCommentView create(@AuthenticationPrincipal AuthUser user,
                                   @PathVariable Long quoteId,
                                   @Valid @RequestBody CreateQuoteCommentRequest request) {
        return commentService.create(user.id(), quoteId, request);
    }

    @Operation(summary = "댓글 삭제 — 본인만")
    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthUser user,
                                       @PathVariable Long quoteId,
                                       @PathVariable Long commentId) {
        commentService.delete(user.id(), quoteId, commentId);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 6: 전체 테스트 통과 확인**

Run: `cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments/server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw test 2>&1 | grep -E "Tests run:|BUILD" | tail -3`
Expected: `Tests run: 100, Failures: 0, Errors: 0` · `BUILD SUCCESS`

- [ ] **Step 7: 커밋**

```bash
cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments && git branch --show-current && git add -A server/src && git commit -q -m "신규: 밑줄 댓글 API — 목록(오래된 순)·작성·본인 삭제

- GET/POST /api/v1/quotes/{quoteId}/comments, DELETE .../{commentId}
- 본문 300자, 1분 20건 도배 제한, QUOTE_COMMENT_NOT_FOUND 에러 코드" && git log --oneline -1
```

---

## Task B4: 서버 기동 스모크 (:8090)

**Files:**
- Create (gitignore 안): `.superpowers/smoke/quote-comments.mjs` (앱 worktree 루트 기준)

**Interfaces:**
- Consumes: B1~B3 의 API 전부. 로그인 계정 `tester1@dev.local / password1234`(이미 DB 에 있음). 두 번째 계정은 없으면 회원가입.

- [ ] **Step 1: 서버 기동(백그라운드, 포트 8090)**

Run (run_in_background): `cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments/server && SERVER_PORT=8090 JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q spring-boot:run 2>&1 | tail -40`

기동 확인(최대 90초 기다림): `curl -s -m 3 -o /dev/null -w "%{http_code}\n" http://localhost:8090/openapi.json`
Expected: `200`. 로그에 `Migrating schema "public" to version "9 - quote comments"` 가 한 번 찍힌다(같은 Postgres 를 :8080 서버와 공유 — 테이블 추가는 기존 서버의 `ddl-auto: validate` 를 깨지 않는다).

- [ ] **Step 2: 스모크 스크립트 작성**

`.superpowers/smoke/quote-comments.mjs`:

```js
// 밑줄 댓글 API 스모크 — node .superpowers/smoke/quote-comments.mjs
const BASE = process.env.BOOKEY_API_URL ?? 'http://localhost:8090';

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

function expect(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? 'OK ' : 'FAIL'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
  if (!ok) process.exitCode = 1;
}

async function login(email) {
  const r = await call('POST', '/api/v1/auth/login', { body: { email, password: 'password1234' } });
  if (r.status === 200) return r.json.accessToken;
  const s = await call('POST', '/api/v1/auth/signup', {
    body: { email, password: 'password1234', nickname: email.split('@')[0] },
  });
  if (s.status !== 200) throw new Error(`login/signup failed for ${email}: ${s.status} ${JSON.stringify(s.json)}`);
  return s.json.accessToken;
}

const a = await login('tester1@dev.local');
const b = await login('tester2@dev.local');

// 401 — 토큰 없이
expect('GET comments without token', (await call('GET', '/api/v1/quotes/1/comments')).status, 401);

// 밑줄 하나 확보 — 피드에 있으면 그것, 없으면 추천 도서로 하나 오려둔다
let quoteId = (await call('GET', '/api/v1/plaza/feed?type=QUOTE&size=1', { token: a })).json.content?.[0]?.quoteId;
if (quoteId == null) {
  const books = (await call('GET', '/api/v1/books/recommended?size=1', { token: a })).json;
  const created = await call('POST', '/api/v1/quotes', { token: a, body: { bookId: books[0].id, content: '스모크 문장', page: 1 } });
  expect('POST quote', created.status, 200);
  quoteId = created.json.id;
}

const before = await call('GET', `/api/v1/quotes/${quoteId}`, { token: a });
expect('GET quote', before.status, 200);
const baseCount = before.json.commentCount;
console.log(`   quote ${quoteId} commentCount=${baseCount}`);

// 작성 → 목록(오래된 순) → 카운트 증가
const c1 = await call('POST', `/api/v1/quotes/${quoteId}/comments`, { token: a, body: { body: '첫 번째 덧붙임' } });
expect('POST comment #1', c1.status, 200);
expect('comment mine', c1.json.mine, true);
const c2 = await call('POST', `/api/v1/quotes/${quoteId}/comments`, { token: b, body: { body: '두 번째 덧붙임' } });
expect('POST comment #2 (other user)', c2.status, 200);

const list = await call('GET', `/api/v1/quotes/${quoteId}/comments?size=50`, { token: a });
expect('GET comments', list.status, 200);
const ids = list.json.content.map((c) => c.id);
expect('oldest first', ids.indexOf(c1.json.id) < ids.indexOf(c2.json.id), true);
expect('other comment mine=false', list.json.content.find((c) => c.id === c2.json.id).mine, false);
expect('commentCount +2', (await call('GET', `/api/v1/quotes/${quoteId}`, { token: a })).json.commentCount, baseCount + 2);
expect('plaza commentCount', (await call('GET', '/api/v1/plaza/feed?type=QUOTE&size=50', { token: a }))
  .json.content.find((i) => i.quoteId === quoteId)?.commentCount, baseCount + 2);

// 검증 — 빈 본문 400, 301자 400, 없는 밑줄 404 (@Valid 실패 코드는 GlobalExceptionHandler 기준 — 400 이 아니면 그 값으로 맞춘다)
expect('POST blank body', (await call('POST', `/api/v1/quotes/${quoteId}/comments`, { token: a, body: { body: '   ' } })).status, 400);
expect('POST 301 chars', (await call('POST', `/api/v1/quotes/${quoteId}/comments`, { token: a, body: { body: 'a'.repeat(301) } })).status, 400);
expect('POST on missing quote', (await call('POST', '/api/v1/quotes/999999999/comments', { token: a, body: { body: 'x' } })).status, 404);

// 삭제 — 남의 것 403, 본인 204, 없는 것 404, 다른 밑줄 경로 404
expect('DELETE other user comment', (await call('DELETE', `/api/v1/quotes/${quoteId}/comments/${c2.json.id}`, { token: a })).status, 403);
expect('DELETE own comment', (await call('DELETE', `/api/v1/quotes/${quoteId}/comments/${c1.json.id}`, { token: a })).status, 204);
expect('DELETE again (missing)', (await call('DELETE', `/api/v1/quotes/${quoteId}/comments/${c1.json.id}`, { token: a })).status, 404);
expect('DELETE via wrong quote path', (await call('DELETE', `/api/v1/quotes/999999999/comments/${c2.json.id}`, { token: b })).status, 404);
expect('DELETE own comment (b)', (await call('DELETE', `/api/v1/quotes/${quoteId}/comments/${c2.json.id}`, { token: b })).status, 204);
expect('commentCount restored', (await call('GET', `/api/v1/quotes/${quoteId}`, { token: a })).json.commentCount, baseCount);

// OpenAPI 노출
const spec = (await call('GET', '/openapi.json')).json;
expect('schema QuoteCommentView', Boolean(spec.components.schemas.QuoteCommentView), true);
expect('BookQuoteView.commentCount', Boolean(spec.components.schemas.BookQuoteView.properties.commentCount), true);
expect('PlazaItemView.commentCount', Boolean(spec.components.schemas.PlazaItemView.properties.commentCount), true);
```

- [ ] **Step 3: 스모크 실행**

Run: `node .superpowers/smoke/quote-comments.mjs`
Expected: 모든 줄이 `OK`, 종료 코드 0. `FAIL` 이 있으면 서버 로그(백그라운드 출력 파일)를 보고 고친 뒤 재기동·재실행. 서버는 **끄지 않는다** — A1 의 타입 재생성과 A6 의 웹 확인이 이 서버를 쓴다.

---

## Task A1: 타입 재생성 · 별칭 · 엔드포인트

**Files:**
- Regenerate: `src/api/generated.ts`
- Modify: `src/api/types.ts` (밑줄 · 광장 블록)
- Modify: `src/api/endpoints.ts` (`quoteApi`, import 목록)

**Interfaces:**
- Consumes: :8090 서버(B4)
- Produces: `QuoteComment`, `CreateQuoteComment` 타입 · `quoteApi.get(quoteId)`, `quoteApi.byBook(bookId, page?, size?)`,
  `quoteApi.comments(quoteId, page?, size?)`, `quoteApi.addComment(quoteId, body: CreateQuoteComment)`,
  `quoteApi.removeComment(quoteId, commentId)`

- [ ] **Step 1: 타입 재생성**

Run: `BOOKEY_API_URL=http://localhost:8090 npm run types 2>&1 | tail -3 && grep -n "QuoteCommentView: {\|commentCount" src/api/generated.ts | head`
Expected: `QuoteCommentView: {` 1개, `commentCount` 가 BookQuoteView·PlazaItemView 에 각 1개.

- [ ] **Step 2: 별칭 추가**

`src/api/types.ts` 의 `export type PlazaItemType = PlazaItem['type'];` 아래에:

```ts
export type QuoteComment = Schemas['QuoteCommentView'];
export type CreateQuoteComment = Schemas['CreateQuoteCommentRequest'];
```

- [ ] **Step 3: 엔드포인트 추가**

`src/api/endpoints.ts` 상단 import 목록(`@/api/types`)에 `CreateQuoteComment`, `QuoteComment` 를 알파벳 순서에 맞게 추가. `quoteApi` 를 아래로 교체:

```ts
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
  /** '나도 그럼' 토글 — 서버가 토글 후 상태를 돌려준다. */
  agree: (quoteId: number) => api<QuoteAgree>(`/api/v1/quotes/${quoteId}/agree`, { method: 'POST' }),
  /** 댓글 — 오래된 순. */
  comments: (quoteId: number, page = 0, size = 30) =>
    api<Page<QuoteComment>>(`/api/v1/quotes/${quoteId}/comments`, { query: { page, size } }),
  addComment: (quoteId: number, body: CreateQuoteComment) =>
    api<QuoteComment>(`/api/v1/quotes/${quoteId}/comments`, { method: 'POST', body }),
  removeComment: (quoteId: number, commentId: number) =>
    api<void>(`/api/v1/quotes/${quoteId}/comments/${commentId}`, { method: 'DELETE' }),
};
```

- [ ] **Step 4: typecheck**

Run: `npm run typecheck 2>&1 | tail -3`
Expected: 에러 없음(`tsc --noEmit` 줄만).

- [ ] **Step 5: 커밋**

```bash
git branch --show-current && git add src/api/generated.ts src/api/types.ts src/api/endpoints.ts && git commit -q -m "수정: 밑줄 댓글 API 타입 재생성 — QuoteComment 별칭·quoteApi 5종(단건·책별·댓글 목록/작성/삭제)" && git log --oneline -1
```

---

## Task A2: 밑줄 캐시 모듈 + 나도 그럼 훅, 광장 리팩터링

**Files:**
- Create: `src/api/quoteCache.ts`
- Create: `src/components/quote/useAgreeQuote.ts`
- Modify: `app/plaza.tsx`

**Interfaces:**
- Consumes: `quoteApi.agree`, 타입 `BookQuote`, `PlazaItem`, `Page`
- Produces: `plazaFeedKey(type)`, `PLAZA_HOME_KEY`, `bookQuotesKey(bookId)`, `quoteKey(quoteId)`, `quoteCommentsKey(quoteId)`,
  `patchQuoteEverywhere(qc, quoteId, patch)`, `toggleAgreePatch`, `bumpCommentPatch(delta)`, `invalidateQuoteLists(qc)`,
  `useAgreeQuote(): (quoteId: number) => void`

- [ ] **Step 1: 캐시 모듈 작성**

`src/api/quoteCache.ts`:

```ts
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { BookQuote, Page, PlazaItem, PlazaItemType } from '@/api/types';

/**
 * 밑줄 캐시 — 같은 문장이 네 곳에 산다.
 *
 * 광장 무한 피드 · 홈 스포트라이트 · 책별 목록 · 상세. 나도 그럼·댓글 수가 바뀌면
 * 네 곳을 한 번에 손봐야 화면끼리 어긋나지 않는다. 키와 패치를 여기 한 곳에 둔다.
 */
export const plazaFeedKey = (type: PlazaItemType) => ['plaza', type] as const;
/** 홈 '오려둔 문장' 스포트라이트(QuoteScraps) — 광장 피드와 갈라 둔 키. */
export const PLAZA_HOME_KEY = ['plaza', 'QUOTE', 'home'] as const;
/** 책별 밑줄(도서 상세 밑줄 탭). `['quotes']` 뿌리라 내 밑줄과 같이 무효화된다. */
export const bookQuotesKey = (bookId: number) => ['quotes', 'book', bookId] as const;
export const quoteKey = (quoteId: number) => ['quote', quoteId] as const;
export const quoteCommentsKey = (quoteId: number) => ['quote', quoteId, 'comments'] as const;

export type PlazaFeedCache = InfiniteData<Page<PlazaItem>>;
export type BookQuotesCache = InfiniteData<Page<BookQuote>>;

/** 네 캐시가 공통으로 가진 반응 필드 — 패치는 이것만 건드린다. */
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

/** 한 문장을 네 캐시에서 찾아 같은 패치를 적용한다. 없는 캐시는 건너뛴다. */
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
}

/** 밑줄이 생기거나 지워졌을 때 — 목록 캐시를 전부 다시 받게 한다. */
export function invalidateQuoteLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['plaza'] });
  queryClient.invalidateQueries({ queryKey: ['quotes'] });
}
```

- [ ] **Step 2: 나도 그럼 훅 작성**

`src/components/quote/useAgreeQuote.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { quoteApi } from '@/api/endpoints';
import {
  PLAZA_HOME_KEY, patchQuoteEverywhere, plazaFeedKey, quoteKey, toggleAgreePatch,
} from '@/api/quoteCache';

/**
 * '나도 그럼' 낙관 토글 — 광장·상세가 같이 쓴다.
 *
 * 응답을 기다리는 사이 같은 문장을 또 누르면 두 뮤테이션이 서로 엇갈려 서버와 다른 카운트가
 * 화면에 눌러앉는다(staleTime + 포커스 재조회 꺼짐이라 저절로 낫지 않는다). 그래서 문장 단위로
 * 한 번에 하나씩만 보낸다. 실패하면 같은 토글을 한 번 더 적용해 되돌린다.
 */
export function useAgreeQuote(): (quoteId: number) => void {
  const queryClient = useQueryClient();
  const inflight = useRef(new Set<number>());

  const agree = useMutation({
    mutationFn: (quoteId: number) => quoteApi.agree(quoteId),
    onMutate: async (quoteId) => {
      // 진행 중인 재조회가 낙관 패치를 덮어쓰지 않게 먼저 멈춘다.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: plazaFeedKey('QUOTE') }),
        queryClient.cancelQueries({ queryKey: PLAZA_HOME_KEY }),
        queryClient.cancelQueries({ queryKey: ['quotes', 'book'] }),
        queryClient.cancelQueries({ queryKey: quoteKey(quoteId) }),
      ]);
      patchQuoteEverywhere(queryClient, quoteId, toggleAgreePatch);
    },
    onError: (_error, quoteId) => {
      patchQuoteEverywhere(queryClient, quoteId, toggleAgreePatch);
    },
    onSuccess: (result, quoteId) => {
      patchQuoteEverywhere(queryClient, quoteId, {
        agreedByMe: result.agreed,
        agreeCount: result.agreeCount,
      });
    },
    // 성공이든 실패든 잠금을 풀어 준다. 여기서 무효화하지 않는다 —
    // 무한 피드 전 페이지를 다시 받아 오는 값이 토글 하나에 비해 너무 비싸다.
    onSettled: (_result, _error, quoteId) => {
      inflight.current.delete(quoteId);
    },
  });

  return (quoteId: number) => {
    if (inflight.current.has(quoteId)) return;
    inflight.current.add(quoteId);
    agree.mutate(quoteId);
  };
}
```

- [ ] **Step 3: 광장이 공용 모듈을 쓰게 수정**

`app/plaza.tsx` 에서:

(a) import 정리 — 아래 네 줄을:
```ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
```
```ts
import type { Page, PlazaItem, PlazaItemType } from '@/api/types';
```
이렇게 교체:
```ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
```
```ts
import { invalidateQuoteLists, plazaFeedKey } from '@/api/quoteCache';
import type { PlazaItem, PlazaItemType } from '@/api/types';
import { useAgreeQuote } from '@/components/quote/useAgreeQuote';
```

(b) 상수 블록에서 `feedKey`, `HOME_KEY`(주석 포함) 와 `type FeedCache = ...` 를 삭제.

(c) 컴포넌트 안에서 `agreeing` ref(주석 포함), `agree` 뮤테이션 전체, `pressAgree` 함수 전체를 삭제하고, `const confirmTimer = ...` 아래에 한 줄:
```ts
  const pressAgree = useAgreeQuote();
```

(d) `feed` 쿼리의 `queryKey: feedKey(type)` → `queryKey: plazaFeedKey(type)`.

(e) `remove` 뮤테이션의 `onSuccess` 를:
```ts
    onSuccess: () => invalidateQuoteLists(queryClient),
```

(f) 파일 하단의 `toggleAgree` 함수와 `patchQuote` 함수(주석 포함)를 삭제. `itemKey` 는 남긴다.

- [ ] **Step 4: typecheck**

Run: `npm run typecheck 2>&1 | tail -5`
Expected: 에러 없음. (`Page` 가 더 이상 안 쓰이면 위 import 에서 이미 뺐다. `useRef` 는 `confirmTimer` 가 계속 쓴다.)

- [ ] **Step 5: 커밋**

```bash
git branch --show-current && git add src/api/quoteCache.ts src/components/quote/useAgreeQuote.ts app/plaza.tsx && git commit -q -m "수정: 밑줄 캐시 키·패치를 공용 모듈로 — 광장·홈·책별·상세 네 캐시 동기화

- src/api/quoteCache.ts: 키 5종, patchQuoteEverywhere, toggleAgreePatch, invalidateQuoteLists
- useAgreeQuote 훅으로 나도 그럼 낙관 토글·인플라이트 가드를 광장 밖으로" && git log --oneline -1
```

---

## Task A3: 공용 `QuoteCard` + 광장 카드 교체(댓글 수·상세 진입)

**Files:**
- Create: `src/components/quote/QuoteCard.tsx`
- Modify: `app/plaza.tsx` (`FeedCard`, 스타일, import)

**Interfaces:**
- Produces: `QuoteCard` props — `authorNickname, authorAvatarUrl?, bookTitle, page?, content, agreeCount, agreedByMe, commentCount, mine, confirming?, error?, tilt?, onAgree, onDelete?, onOpen?, onOpenBook?`

- [ ] **Step 1: QuoteCard 작성**

`src/components/quote/QuoteCard.tsx`:

```tsx
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 푸터 액션 확장 터치 영역(네이티브 전용).
 * 웹은 hitSlop 을 무시하므로 실제 여백(styles.footAction)으로 상자를 키우고,
 * 네이티브는 그 위에 hitSlop 을 더 얹어 넉넉하게 잡는다.
 */
const FOOT_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

export type QuoteCardProps = {
  authorNickname: string;
  authorAvatarUrl?: string | null;
  bookTitle: string;
  page?: number | null;
  content: string;
  agreeCount: number;
  agreedByMe: boolean;
  commentCount: number;
  mine: boolean;
  /** 삭제 재확인 상태 — 라벨이 '한 번 더'로 바뀐다. */
  confirming?: boolean;
  /** 삭제 실패 안내 — 이 카드에서 실패했을 때만 들어온다. */
  error?: string | null;
  /** 카드 회전(도). 광장은 교차 회전, 상세는 살짝만. */
  tilt?: number;
  onAgree: () => void;
  /** 본인 카드에서만 넘긴다. */
  onDelete?: () => void;
  /** 있으면 문장 본문을 눌러 상세로 간다(광장). */
  onOpen?: () => void;
  /** 있으면 푸터 오른쪽에 '책 보기 →'(상세). */
  onOpenBook?: () => void;
};

/** 24px 아바타 — 사진이 없으면 닉네임 첫 글자. 밑줄 카드·완독 카드·댓글 행이 같이 쓴다. */
export function QuoteAvatar({ uri, nickname }: { uri?: string | null; nickname: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised, borderColor: colors.line }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatarImage} resizeMode="cover" />
      ) : (
        <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>{nickname.slice(0, 1)}</Text>
      )}
    </View>
  );
}

/** 밑줄 카드 — 광장 피드와 밑줄 상세가 같은 카드를 쓴다(시안 2d · D1). */
export function QuoteCard({
  authorNickname, authorAvatarUrl, bookTitle, page, content, agreeCount, agreedByMe, commentCount,
  mine, confirming = false, error, tilt = 0, onAgree, onDelete, onOpen, onOpenBook,
}: QuoteCardProps) {
  const { colors } = useTheme();

  const body = (
    <Text style={[styles.quote, { color: colors.text, borderLeftColor: colors.accent }]}>
      {content}
    </Text>
  );

  return (
    <Card style={{ ...styles.card, transform: [{ rotate: `${tilt}deg` }] }}>
      <View style={styles.authorRow}>
        <QuoteAvatar uri={authorAvatarUrl} nickname={authorNickname} />
        <View style={styles.authorText}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
            {authorNickname}
          </Text>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.where, { color: colors.textFaint }]}>
            {bookTitle}
            {page != null ? ` · ${page}쪽` : ''}
          </Text>
        </View>
      </View>

      {onOpen ? (
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="밑줄 상세">
          {body}
        </Pressable>
      ) : body}

      <View style={styles.footRow}>
        {/* 10px 활자라 글자 상자(16px)만으로는 손가락이 닿지 않는다 — 여백으로 36px 까지 넓힌다. */}
        <Pressable onPress={onAgree} hitSlop={FOOT_HIT_SLOP} style={styles.footAction}
          accessibilityRole="button"
          accessibilityState={{ selected: agreedByMe }}
          accessibilityLabel={`나도 그럼 ${agreeCount}`}>
          <Text style={[typeScale.monoLabel, styles.footLabel, {
            color: agreedByMe ? colors.accent : colors.textMuted,
          }]}>
            나도 그럼 {agreeCount}
          </Text>
        </Pressable>
        {onOpen ? (
          <Pressable onPress={onOpen} hitSlop={FOOT_HIT_SLOP} style={styles.footAction}
            accessibilityRole="button" accessibilityLabel={`댓글 ${commentCount}`}>
            <Text style={[typeScale.monoLabel, styles.footLabel, { color: colors.textMuted }]}>
              댓글 {commentCount}
            </Text>
          </Pressable>
        ) : (
          <Text style={[typeScale.monoLabel, styles.footLabel, styles.footAction, { color: colors.textMuted }]}>
            댓글 {commentCount}
          </Text>
        )}
        <View style={styles.footRight}>
          {onOpenBook ? (
            <Pressable onPress={onOpenBook} hitSlop={FOOT_HIT_SLOP} style={styles.footAction}
              accessibilityRole="button" accessibilityLabel={`${bookTitle} 상세`}>
              <Text style={[typeScale.monoLabel, styles.footLabel, { color: colors.accent }]}>책 보기 →</Text>
            </Pressable>
          ) : null}
          {mine && onDelete ? (
            <Pressable onPress={onDelete} hitSlop={FOOT_HIT_SLOP} style={styles.footAction}
              accessibilityRole="button" accessibilityLabel={confirming ? '삭제 확인' : '삭제'}>
              <Text style={[typeScale.monoLabel, styles.footLabel, {
                color: confirming ? colors.danger : colors.textFaint,
              }]}>
                {confirming ? '한 번 더' : '삭제'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? <Text style={[typeScale.caption, { color: colors.warn }]}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: hairline,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  authorText: { flex: 1 },
  nickname: { fontSize: 12 },
  where: { fontSize: 9, letterSpacing: 0.4, marginTop: 2 },
  // 시안 2d 의 인용 본문 — quote 토큰을 15/1.65 로 줄이고 왼쪽에 악센트 선을 세운다.
  quote: { ...typeScale.quote, fontSize: 15, lineHeight: 25, borderLeftWidth: 2, paddingLeft: 11 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  footRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  footLabel: { fontSize: 10, letterSpacing: 0.4 },
  // 여백으로 손가락 상자를 키우되, 같은 크기의 음수 마진으로 카드 안 리듬은 그대로 둔다.
  footAction: { paddingVertical: 10, paddingHorizontal: 6, marginVertical: -6, marginHorizontal: -6 },
});
```

- [ ] **Step 2: 광장 FeedCard 교체**

`app/plaza.tsx` 에서:

(a) import 추가: `import { QuoteAvatar, QuoteCard } from '@/components/quote/QuoteCard';`. `FOOT_HIT_SLOP` 상수(주석 포함)는 삭제. react-native import 에서 `Image` 를 뺀다(아바타는 `QuoteAvatar` 가 그린다).

(b) `renderItem` 을 아래로 교체:
```tsx
        renderItem={({ item, index }) => (
          <FeedCard
            item={item}
            index={index}
            mine={myId != null && item.authorId === myId}
            confirming={item.quoteId != null && confirmId === item.quoteId}
            error={item.quoteId != null && removeError?.id === item.quoteId ? removeError.message : null}
            onAgree={() => {
              if (item.quoteId != null) pressAgree(item.quoteId);
            }}
            onDelete={() => {
              if (item.quoteId != null) pressDelete(item.quoteId);
            }}
            onOpen={() => {
              if (item.quoteId != null) router.push(`/quote/${item.quoteId}`);
            }}
            onOpenBook={() => router.push(`/book/${item.bookId}`)}
          />
        )}
```

(c) `FeedCard` 함수 전체를 아래로 교체:
```tsx
/** 피드 카드 한 장 — 밑줄은 공용 QuoteCard, 완독 자랑은 표지 행. 같은 교차 회전을 쓴다. */
function FeedCard({ item, index, mine, confirming, error, onAgree, onDelete, onOpen, onOpenBook }: {
  item: PlazaItem;
  index: number;
  mine: boolean;
  confirming: boolean;
  /** 삭제 실패 안내 — 이 카드에서 실패했을 때만 들어온다. */
  error?: string | null;
  onAgree: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onOpenBook: () => void;
}) {
  const { colors } = useTheme();
  const tilt = CARD_TILT[index % CARD_TILT.length];

  if (item.type === 'QUOTE') {
    return (
      <View style={styles.cardWrap}>
        <QuoteCard
          tilt={tilt}
          authorNickname={item.authorNickname}
          authorAvatarUrl={item.authorAvatarUrl}
          bookTitle={item.bookTitle}
          page={item.page}
          content={item.content ?? ''}
          agreeCount={item.agreeCount ?? 0}
          agreedByMe={item.agreedByMe ?? false}
          commentCount={item.commentCount ?? 0}
          mine={mine}
          confirming={confirming}
          error={error}
          onAgree={onAgree}
          onDelete={mine ? onDelete : undefined}
          onOpen={onOpen}
        />
      </View>
    );
  }

  return (
    <Card style={{ ...styles.card, transform: [{ rotate: `${tilt}deg` }] }}>
      <View style={styles.authorRow}>
        <QuoteAvatar uri={item.authorAvatarUrl} nickname={item.authorNickname} />
        <View style={styles.authorText}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
            {item.authorNickname}
          </Text>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.where, { color: colors.textFaint }]}>
            {item.bookTitle}
          </Text>
        </View>
      </View>
      <Pressable onPress={onOpenBook} accessibilityRole="button" accessibilityLabel={`${item.bookTitle} 상세`} style={styles.finishRow}>
        <TiltCover uri={item.bookCoverUrl} title={item.bookTitle} width={44} entering={false} />
        <View style={styles.finishText}>
          <Text numberOfLines={2} style={[typeScale.bodyStrong, { color: colors.text }]}>
            {item.bookTitle}
          </Text>
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>
            완독 · {formatRelative(item.occurredAt)}
          </Text>
        </View>
      </Pressable>
    </Card>
  );
}
```
(d) 스타일: `card`, `authorRow`, `authorText`, `nickname`, `where`, `finishRow`, `finishText` 는 남기고, `avatar`, `avatarImage`, `quote`, `footRow`, `footLabel`, `footAction`, `deleteButton` 은 삭제(아바타 스타일은 QuoteCard.tsx 로 옮겨졌다). `card` 옆에 추가:
```ts
  cardWrap: { marginHorizontal: spacing.lg },
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck 2>&1 | tail -5`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git branch --show-current && git add src/components/quote/QuoteCard.tsx app/plaza.tsx && git commit -q -m "신규: 밑줄 카드 공용화 — 광장 카드에 댓글 수 표시, 문장 눌러 상세 진입" && git log --oneline -1
```

---

## Task A4: 밑줄 상세 화면 `app/quote/[id].tsx`

**Files:**
- Create: `app/quote/[id].tsx`
- Modify: `app/_layout.tsx` (`book/[id]` 등록 아래)

**Interfaces:**
- Consumes: `quoteApi.get/comments/addComment/removeComment/remove`, `QuoteCard`, `useAgreeQuote`, `quoteKey`, `quoteCommentsKey`, `patchQuoteEverywhere`, `bumpCommentPatch`, `invalidateQuoteLists`
- Produces: 라우트 `/quote/[id]`

- [ ] **Step 1: 화면 등록**

`app/_layout.tsx` 의 `<Stack.Screen name="book/[id]" options={{ title: '도서' }} />` 아래에:
```tsx
            <Stack.Screen name="quote/[id]" options={{ title: '밑줄' }} />
```

- [ ] **Step 2: 화면 작성**

`app/quote/[id].tsx`:

```tsx
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text,
  TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { quoteApi } from '@/api/endpoints';
import {
  bumpCommentPatch, invalidateQuoteLists, patchQuoteEverywhere, quoteCommentsKey, quoteKey,
} from '@/api/quoteCache';
import type { QuoteComment } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { QuoteAvatar, QuoteCard } from '@/components/quote/QuoteCard';
import { useAgreeQuote } from '@/components/quote/useAgreeQuote';
import { EmptyState, formatRelative } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 댓글 한 페이지 — 오래된 순이라 다음 페이지가 더 새 댓글이다. */
const PAGE_SIZE = 30;
/** 댓글 길이 상한 — 서버 계약과 같은 값. */
const BODY_MAX = 300;
/** 삭제 재확인이 살아 있는 시간(ms). 광장과 같은 값. */
const DELETE_CONFIRM_MS = 3000;
/** 상세 카드는 살짝만 기울인다 — 읽는 화면이라 광장보다 얌전하게. */
const CARD_TILT = -0.6;

/**
 * 밑줄 상세(D1) — 광장에서 본 카드가 그대로 위에 오고, 아래로 댓글이 붙는다.
 * 입력 바는 화면 아래 고정. 광장 카드·도서 상세 밑줄 조각에서 들어온다.
 */
export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quoteId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const pressAgree = useAgreeQuote();

  const quote = useQuery({
    queryKey: quoteKey(quoteId),
    queryFn: () => quoteApi.get(quoteId),
    enabled: Number.isFinite(quoteId),
  });

  const comments = useInfiniteQuery({
    queryKey: quoteCommentsKey(quoteId),
    queryFn: ({ pageParam }) => quoteApi.comments(quoteId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
    enabled: Number.isFinite(quoteId),
  });
  const items = comments.data?.pages.flatMap((p) => p.content ?? []) ?? [];

  // 삭제 재확인 — 밑줄과 댓글이 같은 타이머를 나눠 쓴다(한 번에 하나만 확인 상태).
  const [confirm, setConfirm] = useState<{ kind: 'quote' } | { kind: 'comment'; id: number } | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);
  const arm = (next: NonNullable<typeof confirm>) => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirm(next);
    confirmTimer.current = setTimeout(() => {
      confirmTimer.current = null;
      setConfirm(null);
    }, DELETE_CONFIRM_MS);
  };
  const disarm = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = null;
    setConfirm(null);
  };

  const [removeError, setRemoveError] = useState<string | null>(null);
  const removeQuote = useMutation({
    mutationFn: () => quoteApi.remove(quoteId),
    onMutate: () => setRemoveError(null),
    onSuccess: () => {
      invalidateQuoteLists(queryClient);
      queryClient.removeQueries({ queryKey: quoteKey(quoteId) });
      if (router.canGoBack()) router.back();
      else router.replace('/plaza');
    },
    onError: (error) => {
      setRemoveError(error instanceof ApiError ? error.message : '삭제하지 못했어요 · 다시 시도');
    },
  });
  const pressDeleteQuote = () => {
    if (confirm?.kind === 'quote') {
      disarm();
      removeQuote.mutate();
      return;
    }
    arm({ kind: 'quote' });
  };

  const [commentError, setCommentError] = useState<{ id: number; message: string } | null>(null);
  const removeComment = useMutation({
    mutationFn: (commentId: number) => quoteApi.removeComment(quoteId, commentId),
    onMutate: () => setCommentError(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteCommentsKey(quoteId) });
      patchQuoteEverywhere(queryClient, quoteId, bumpCommentPatch(-1));
    },
    onError: (error, commentId) => {
      setCommentError({
        id: commentId,
        message: error instanceof ApiError ? error.message : '삭제하지 못했어요 · 다시 시도',
      });
    },
  });
  const pressDeleteComment = (commentId: number) => {
    if (confirm?.kind === 'comment' && confirm.id === commentId) {
      disarm();
      removeComment.mutate(commentId);
      return;
    }
    arm({ kind: 'comment', id: commentId });
  };

  const header = quote.data ? (
    <View style={styles.headerWrap}>
      <QuoteCard
        tilt={CARD_TILT}
        authorNickname={quote.data.authorNickname}
        authorAvatarUrl={quote.data.authorAvatarUrl}
        bookTitle={quote.data.bookTitle}
        page={quote.data.page}
        content={quote.data.content}
        agreeCount={quote.data.agreeCount}
        agreedByMe={quote.data.agreedByMe}
        commentCount={quote.data.commentCount}
        mine={quote.data.mine}
        confirming={confirm?.kind === 'quote'}
        error={removeError}
        onAgree={() => pressAgree(quoteId)}
        onDelete={quote.data.mine ? pressDeleteQuote : undefined}
        onOpenBook={() => router.push(`/book/${quote.data!.bookId}`)}
      />
      <View style={styles.commentsHead}>
        <Text style={[styles.commentsTitle, { color: colors.text }]}>댓글</Text>
        {comments.isError ? (
          <Pressable onPress={() => comments.refetch()} hitSlop={8} accessibilityRole="button">
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>불러오지 못했어요 · 다시 시도</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  ) : null;

  const empty = quote.isLoading ? (
    <View style={[styles.skeleton, { backgroundColor: colors.surface }]} />
  ) : quote.isError ? (
    <EmptyState
      title="밑줄을 불러오지 못했습니다"
      description={quote.error instanceof ApiError && quote.error.status === 404
        ? '지워졌거나 없는 밑줄입니다.'
        : '잠시 후 다시 시도해 주세요.'}
    />
  ) : comments.isLoading ? (
    <View style={styles.footer}>
      <ActivityIndicator size="small" color={colors.accent} />
    </View>
  ) : comments.isError ? null : (
    <Text style={[typeScale.caption, styles.emptyComments, { color: colors.textFaint }]}>
      아직 덧붙인 말이 없어요. 첫 마디를 남겨보세요.
    </Text>
  );

  return (
    <PaperScreen>
      <SubHeader category="밑줄" />
      {/* 오프셋 없음 — 헤더리스라 KAV 의 frame.y 가 이미 SubHeader 를 포함한다(토론 화면과 같은 이유). */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <CommentRow
              comment={item}
              confirming={confirm?.kind === 'comment' && confirm.id === item.id}
              error={commentError?.id === item.id ? commentError.message : null}
              onDelete={() => pressDeleteComment(item.id)}
            />
          )}
          ListFooterComponent={
            comments.isFetchingNextPage ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : comments.hasNextPage ? (
              <Pressable onPress={() => comments.fetchNextPage()} accessibilityRole="button"
                hitSlop={8} style={styles.more}>
                <Text style={[typeScale.monoLabel, { color: colors.accent }]}>댓글 더 보기 →</Text>
              </Pressable>
            ) : null
          }
        />
        {quote.data ? <CommentComposer quoteId={quoteId} /> : null}
      </KeyboardAvoidingView>
    </PaperScreen>
  );
}

/** 댓글 한 줄 — 아바타 이니셜 · 닉네임 · 본문 · 상대 시각 · (본인) 삭제. */
function CommentRow({ comment, confirming, error, onDelete }: {
  comment: QuoteComment;
  confirming: boolean;
  error: string | null;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <QuoteAvatar uri={comment.authorAvatarUrl} nickname={comment.authorNickname} />
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
          {comment.authorNickname}
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{comment.body}</Text>
        <View style={styles.metaRow}>
          <Text style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>
            {formatRelative(comment.createdAt)}
          </Text>
          {comment.mine ? (
            <Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button"
              accessibilityLabel={confirming ? '삭제 확인' : '삭제'}>
              <Text style={[typeScale.monoLabel, styles.meta, {
                color: confirming ? colors.danger : colors.textFaint,
              }]}>
                {confirming ? '한 번 더' : '삭제'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {error ? <Text style={[typeScale.caption, { color: colors.warn }]}>{error}</Text> : null}
      </View>
    </View>
  );
}

/** 하단 고정 입력 바 — 비어 있거나 전송 중이면 '남기기'가 죽는다. */
function CommentComposer({ quoteId }: { quoteId: number }) {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [body, setBody] = useState('');
  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= BODY_MAX;

  const create = useMutation({
    mutationFn: () => quoteApi.addComment(quoteId, { body: trimmed }),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: quoteCommentsKey(quoteId) });
      patchQuoteEverywhere(queryClient, quoteId, bumpCommentPatch(1));
    },
  });

  const errorMessage = create.isError && !create.isPending
    ? create.error instanceof ApiError ? create.error.message : '남기지 못했어요 · 다시 시도'
    : null;

  return (
    <View style={[styles.bar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
      <View style={styles.barRow}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="이 문장에 덧붙이기…"
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={BODY_MAX}
          accessibilityLabel="댓글"
          style={[styles.input, {
            backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
          }]}
        />
        <Pressable
          onPress={() => create.mutate()}
          disabled={!canSubmit || create.isPending}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit || create.isPending }}
          style={[styles.send, {
            backgroundColor: colors.accent,
            opacity: !canSubmit || create.isPending ? 0.35 : 1,
          }]}
        >
          <Text style={[typeScale.monoLabel, { color: colors.onAccent }]}>
            {create.isPending ? '남기는 중…' : '남기기'}
          </Text>
        </Pressable>
      </View>
      {errorMessage ? (
        <Text style={[typeScale.caption, styles.barError, { color: colors.warn }]}>{errorMessage}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  headerWrap: { gap: spacing.lg, marginBottom: spacing.xs },
  commentsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  commentsTitle: { ...typeScale.titleSerif, fontSize: 15, lineHeight: 20 },
  skeleton: { height: 160, borderRadius: radius.md },
  emptyComments: { paddingVertical: spacing.md },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  more: { paddingVertical: spacing.md, alignItems: 'center' },

  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowBody: { flex: 1, gap: 2 },
  nickname: { fontSize: 12 },
  body: { ...typeScale.body, fontSize: 13, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  meta: { fontSize: 9, letterSpacing: 0.4 },

  bar: { ...layout.content, borderTopWidth: hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: hairline,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typeScale.body,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  send: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 3 },
  barError: { marginTop: spacing.xs },
});
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck 2>&1 | tail -5`
Expected: 에러 없음. (`quote.data!.bookId` 는 `header` 가 `quote.data` 가 있을 때만 만들어지므로 안전하다.)

- [ ] **Step 4: 커밋**

```bash
git branch --show-current && git add "app/quote/[id].tsx" app/_layout.tsx && git commit -q -m "신규: 밑줄 상세 화면 — 카드 + 댓글 목록(오래된 순) + 하단 입력 바, 본인 댓글·밑줄 삭제" && git log --oneline -1
```

---

## Task A5: 도서 상세 — 리뷰 | 밑줄 탭 + 책별 밑줄 목록 + 인라인 오려두기

**Files:**
- Create: `src/components/book/BookQuotesTab.tsx`
- Modify: `app/book/[id].tsx` (`ReviewSection`, 스타일, import)

**Interfaces:**
- Consumes: `quoteApi.byBook/create`, `bookQuotesKey`, `invalidateQuoteLists`, `MemoScrap`, `Card`
- Produces: `BookQuotesTab({ bookId, rid, open, onClose })`

- [ ] **Step 1: 밑줄 탭 컴포넌트 작성**

`src/components/book/BookQuotesTab.tsx`:

```tsx
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { quoteApi } from '@/api/endpoints';
import { bookQuotesKey, invalidateQuoteLists } from '@/api/quoteCache';
import type { BookQuote } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { Button, Card } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

/** 한 번에 받는 밑줄 수 — 섹션 안에 붙는 조각이라 적게. */
const PAGE_SIZE = 5;
/** 문장 길이 상한 — 서버 계약과 같은 값. */
const CONTENT_MAX = 500;

/**
 * 도서 상세 리뷰 섹션의 '밑줄' 탭 — 이 책에 달린 밑줄을 점선 메모 조각으로 늘어놓는다.
 * 조각을 누르면 밑줄 상세로 간다. `open` 이면 위에 인라인 오려두기 폼이 펼쳐진다(rid 필요).
 */
export function BookQuotesTab({ bookId, rid, open, onClose }: {
  bookId: number;
  /** 이 책의 읽기 기록 id — 없으면 오려두기 폼을 열 수 없다(호출 쪽에서 액션을 숨긴다). */
  rid: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();

  const quotes = useInfiniteQuery({
    queryKey: bookQuotesKey(bookId),
    queryFn: ({ pageParam }) => quoteApi.byBook(bookId, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
    enabled: Number.isFinite(bookId),
  });
  const items = quotes.data?.pages.flatMap((p) => p.content ?? []) ?? [];

  return (
    <View style={styles.wrap}>
      {open && rid != null ? (
        <QuoteComposer bookId={bookId} rid={rid} onDone={onClose} />
      ) : null}

      {quotes.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : quotes.isError ? (
        <Card>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>밑줄을 불러오지 못했습니다.</Text>
          <Pressable onPress={() => quotes.refetch()} hitSlop={8} accessibilityRole="button">
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
          </Pressable>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <Text style={[typeScale.caption, { color: colors.textMuted }]}>
            아직 이 책에 밑줄이 없어요. 읽다가 걸린 문장을 오려두세요.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {items.map((quote, index) => (
            <QuoteScrap key={quote.id} quote={quote} rotate={index % 2 === 0 ? -1 : 1}
              onPress={() => router.push(`/quote/${quote.id}`)} />
          ))}
          {quotes.isFetchingNextPage ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : quotes.hasNextPage ? (
            <Pressable onPress={() => quotes.fetchNextPage()} accessibilityRole="button" hitSlop={8}
              style={styles.center}>
              <Text style={[typeScale.monoLabel, { color: colors.accent }]}>밑줄 더 보기 →</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** 밑줄 조각 — 문장 + 모노 메타(작성자 · 쪽 · 나도 그럼 · 댓글). 통째로 눌러 상세로. */
function QuoteScrap({ quote, rotate, onPress }: { quote: BookQuote; rotate: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="밑줄 상세">
      <MemoScrap rotate={rotate}>
        <Text style={[styles.scrapText, { color: colors.text, borderLeftColor: colors.accent }]}>
          {quote.content}
        </Text>
        <View style={styles.scrapMeta}>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.scrapMetaText, styles.scrapWho, { color: colors.textMuted }]}>
            {quote.authorNickname}
            {quote.page != null ? ` · ${quote.page}쪽` : ''}
          </Text>
          <Text style={[typeScale.monoLabel, styles.scrapMetaText, {
            color: quote.agreedByMe ? colors.accent : colors.textFaint,
          }]}>
            나도 그럼 {quote.agreeCount}
          </Text>
          <Text style={[typeScale.monoLabel, styles.scrapMetaText, { color: colors.accent }]}>
            댓글 {quote.commentCount}
          </Text>
        </View>
      </MemoScrap>
    </Pressable>
  );
}

/** 인라인 오려두기 — 책이 정해져 있어 고르기 없이 문장·쪽만 받는다(리뷰 폼과 같은 카드 펼침). */
function QuoteComposer({ bookId, rid, onDone }: { bookId: number; rid: number; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [content, setContent] = useState('');
  const [pageText, setPageText] = useState('');

  const trimmedPage = pageText.trim();
  const pageValue = trimmedPage === '' ? undefined : Number(trimmedPage);
  const pageValid = pageValue === undefined || (Number.isInteger(pageValue) && pageValue >= 1);
  const body = content.trim();
  const canSubmit = body.length > 0 && body.length <= CONTENT_MAX && pageValid;

  const create = useMutation({
    mutationFn: () => quoteApi.create({ bookId, readingRecordId: rid, content: body, page: pageValue }),
    onSuccess: () => {
      invalidateQuoteLists(queryClient);
      onDone();
    },
  });

  const errorMessage = create.isError && !create.isPending
    ? create.error instanceof ApiError ? create.error.message : '오려두지 못했어요 · 다시 시도'
    : null;

  return (
    <Card style={styles.composer}>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="마음에 걸린 문장을 옮겨 적어 보세요."
        placeholderTextColor={colors.textFaint}
        multiline
        maxLength={CONTENT_MAX}
        accessibilityLabel="문장"
        style={[styles.contentInput, {
          backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
        }]}
      />
      <View style={styles.composerMeta}>
        <TextInput
          value={pageText}
          onChangeText={setPageText}
          placeholder="쪽(선택)"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          accessibilityLabel="쪽수"
          style={[styles.pageInput, {
            backgroundColor: colors.surfaceDeep,
            borderColor: pageValid ? colors.line : colors.danger,
            color: colors.text,
          }]}
        />
        <Text style={[typeScale.monoLabel, { color: content.length >= CONTENT_MAX ? colors.warn : colors.textFaint }]}>
          {content.length}/{CONTENT_MAX}
        </Text>
      </View>
      {!pageValid ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>쪽수는 1 이상의 숫자로 적어 주세요.</Text>
      ) : null}
      {errorMessage ? <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text> : null}
      <View style={styles.composerActions}>
        <Button
          label={create.isPending ? '오리는 중…' : '오려두기'}
          onPress={() => create.mutate()}
          disabled={!canSubmit || create.isPending}
          style={styles.composerButton}
        />
        <Button label="취소" variant="outline" onPress={onDone} disabled={create.isPending} style={styles.composerButton} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  list: { gap: spacing.md },
  center: { paddingVertical: spacing.md, alignItems: 'center' },
  // 인용 본문 — 명조 14/1.7, 왼쪽에 악센트 선.
  scrapText: { fontFamily: serif.regular, fontSize: 14, lineHeight: 24, borderLeftWidth: 2, paddingLeft: 10 },
  scrapMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  scrapMetaText: { fontSize: 9, letterSpacing: 0.4 },
  scrapWho: { flex: 1 },

  composer: { gap: spacing.md },
  contentInput: {
    minHeight: 92,
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: serif.regular,
    fontSize: 15,
    lineHeight: 25,
    textAlignVertical: 'top',
  },
  composerMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pageInput: {
    width: 84,
    borderWidth: hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typeScale.monoNumeral,
  },
  composerActions: { flexDirection: 'row', gap: spacing.sm },
  composerButton: { flex: 1 },
});
```

- [ ] **Step 2: ReviewSection 을 탭 섹션으로**

`app/book/[id].tsx` 에서:

(a) import 추가:
```ts
import { BookQuotesTab } from '@/components/book/BookQuotesTab';
```

(b) `import { Fragment, useRef, useState } from 'react';` 아래에 한 줄 추가:
```ts
import type { ReactNode } from 'react';
```

(c) 기존 `ReviewSection` 함수 전체(doc 주석 `/** 리뷰 목록 + (record 있을 때) 인라인 작성 폼. */` 부터 함수의 닫는 `}` 까지)를 아래 코드로 **통째로 교체**한다. 폼·리뷰 목록 마크업은 기존 것을 그대로 옮긴 것이고, 달라진 점은 제목줄이 탭 헤더가 되고(개수 없음), 액션이 탭별로 갈리며, 밑줄 탭이면 `BookQuotesTab` 을 그린다는 것뿐이다:

```tsx
type RecordTab = 'REVIEW' | 'QUOTE';
const RECORD_TABS: { value: RecordTab; label: string }[] = [
  { value: 'REVIEW', label: '리뷰' },
  { value: 'QUOTE', label: '밑줄' },
];

/** 섹션 제목 자리에 놓는 두 글자 탭 — 켜진 쪽만 밝고 아래 민트 밑줄 토막(A1). 개수는 적지 않는다. */
function TabbedSectionHeader<T extends string>({ tabs, value, onChange, action, colors }: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  action?: ReactNode;
  colors: ColorTokens;
}) {
  return (
    <View style={styles.tabHeader}>
      <View style={styles.tabRow}>
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <Pressable key={t.value} onPress={() => onChange(t.value)} hitSlop={8}
              accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.tab}>
              <Text style={[styles.tabTitle, { color: active ? colors.text : colors.textFaint }]}>{t.label}</Text>
              <View style={[styles.tabRule, { backgroundColor: active ? colors.accent : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
      {action}
    </View>
  );
}

/** 리뷰 | 밑줄 탭 섹션(A1) — 리뷰 목록·인라인 작성 폼과 책별 밑줄 탭을 한 제목줄 아래에 둔다. */
function ReviewSection({ bookId, rid, colors }: { bookId: number; rid: number | null; colors: ColorTokens }) {
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: ['book', bookId, 'reviews'],
    queryFn: () => bookApi.reviews(bookId),
    enabled: Number.isFinite(bookId),
  });

  const [tab, setTab] = useState<RecordTab>('REVIEW');
  const [open, setOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');

  // 탭을 바꾸면 펼쳐져 있던 작성 폼은 닫는다 — 다른 탭 밑에 폼이 숨어 있지 않게.
  const switchTab = (next: RecordTab) => {
    if (next === tab) return;
    setOpen(false);
    setQuoteOpen(false);
    setTab(next);
  };

  const create = useMutation({
    mutationFn: () =>
      reviewApi.create({ readingRecordId: rid!, rating: rating || undefined, body: body.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review', 'preview', rid] });
      setOpen(false);
      setDone(true);
    },
  });

  const errorMessage =
    create.isError && !create.isPending
      ? create.error instanceof ApiError
        ? create.error.message
        : '등록하지 못했어요 · 다시 시도'
      : null;

  const items = reviews.data?.content ?? [];

  // 우측 액션은 탭별 — 리뷰는 '쓰기', 밑줄은 '오려두기'. 둘 다 이 책의 읽기 기록이 있어야 보인다.
  const action = tab === 'REVIEW'
    ? (rid != null && !done && !open ? (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={8}>
          <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>쓰기 →</Text>
        </Pressable>
      ) : null)
    : (rid != null && !quoteOpen ? (
        <Pressable onPress={() => setQuoteOpen(true)} accessibilityRole="button" hitSlop={8}>
          <Text style={[typeScale.monoEyebrow, { color: colors.accent }]}>오려두기 →</Text>
        </Pressable>
      ) : null);

  return (
    <View style={styles.section}>
      <TabbedSectionHeader tabs={RECORD_TABS} value={tab} onChange={switchTab} action={action} colors={colors} />

      {tab === 'QUOTE' ? (
        <BookQuotesTab bookId={bookId} rid={rid} open={quoteOpen} onClose={() => setQuoteOpen(false)} />
      ) : (
        <>
          {open ? (
            <Card style={styles.formCard}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n === rating ? 0 : n)} hitSlop={6}
                    accessibilityRole="button" accessibilityLabel={`별점 ${n}`}>
                    <Text style={{ fontSize: 24, color: n <= rating ? colors.accent : colors.lineStrong }}>★</Text>
                  </Pressable>
                ))}
                <Text style={[typeScale.caption, { color: colors.textFaint, marginLeft: spacing.sm }]}>
                  {rating > 0 ? `${rating}점` : '별점 선택 (선택 사항)'}
                </Text>
              </View>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="이 책은 어땠나요?"
                placeholderTextColor={colors.textFaint}
                multiline
                style={[styles.reviewInput, {
                  backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
                }]}
              />
              {errorMessage ? (
                <Text style={[typeScale.caption, { color: colors.warn }]}>{errorMessage}</Text>
              ) : null}
              <View style={styles.formActions}>
                <Button
                  label={create.isPending ? '등록 중…' : '등록'}
                  onPress={() => create.mutate()}
                  disabled={body.trim().length === 0 || create.isPending}
                  style={styles.formButton}
                />
                <Button
                  label="취소"
                  variant="outline"
                  onPress={() => setOpen(false)}
                  disabled={create.isPending}
                  style={styles.formButton}
                />
              </View>
            </Card>
          ) : null}

          {items.length === 0 ? (
            <Card>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                아직 리뷰가 없어요. 이 책의 첫 리뷰를 남겨보세요.
              </Text>
            </Card>
          ) : (
            <View style={styles.reviewList}>
              {items.map((review, index) => {
                const verified = review.verificationLevel === 'VERIFIED_FULL';
                return (
                  // 오려 붙인 메모 조각 — 인덱스 기준 ±1° 교차 회전으로 붙인 티를 낸다
                  <MemoScrap key={review.id} rotate={index % 2 === 0 ? -1 : 1}>
                    <View style={styles.reviewHead}>
                      <Text numberOfLines={1} style={[typeScale.label, styles.reviewAuthor, { color: colors.text }]}>
                        {review.authorNickname}
                      </Text>
                      {review.rating ? (
                        <Text style={[typeScale.monoNumeral, { color: colors.accent }]}>★ {review.rating}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.reviewBody, { color: colors.textMuted }]}>{review.body}</Text>
                    <Text style={[typeScale.monoEyebrow, { color: verified ? colors.accent : colors.textFaint }]}>
                      {VERIFICATION_LABEL[review.verificationLevel]}
                    </Text>
                  </MemoScrap>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}
```

(d) `SectionHeader` 는 다른 섹션(책 소개·세션 기록)이 계속 쓰므로 import 를 남긴다. `groupNumber` 도 스탯 스트립에서 쓰므로 남긴다.

(e) 스타일에 추가(`reviewList` 위):
```ts
  // 리뷰|밑줄 탭 헤더 — SectionHeader 와 같은 높이·간격, 제목은 명조 18.
  tabHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  tabRow: { flexDirection: 'row', gap: 18 },
  tab: { gap: 6 },
  tabTitle: { ...typeScale.titleSerif, fontSize: 18, lineHeight: 24 },
  tabRule: { width: 22, height: 2 },
```


- [ ] **Step 3: typecheck**

Run: `npm run typecheck 2>&1 | tail -8`
Expected: 에러 없음. 흔한 실수: (d) 의 삼항 괄호 짝 — 에러가 나면 `{tab === 'REVIEW' ? (items.length === 0 ? (<Card>…</Card>) : (<View style={styles.reviewList}>…</View>)) : null}` 구조인지 확인.

- [ ] **Step 4: 커밋**

```bash
git branch --show-current && git add src/components/book/BookQuotesTab.tsx "app/book/[id].tsx" && git commit -q -m "신규: 도서 상세 리뷰 섹션을 리뷰 | 밑줄 탭으로 — 책별 밑줄 조각·더 보기·인라인 오려두기" && git log --oneline -1
```

---

## Task A6: 웹 육안 확인 · 마무리

**Files:** 없음(검증). 실패 시 해당 태스크 파일을 고치고 `수정:` 커밋.

- [ ] **Step 1: 웹 기동(백그라운드)**

Run (run_in_background): `EXPO_PUBLIC_API_URL=http://localhost:8090 npm run web 2>&1 | tail -20`
확인: `curl -s -m 5 -o /dev/null -w "%{http_code}\n" http://localhost:8081/` → `200`. (:8090 서버가 살아 있어야 한다 — B4.)

- [ ] **Step 2: 육안 체크리스트** (브라우저 `http://localhost:8081`, `tester1@dev.local / password1234`)

- 광장: 밑줄 카드 푸터에 `나도 그럼 N` `댓글 N`. 문장 또는 `댓글 N` 탭 → `/quote/[id]` 로 이동. 완독 자랑 카드는 그대로.
- 상세: 광장과 같은 카드 + `책 보기 →`. 댓글 남기기 → 목록 맨 아래에 붙고 카드의 `댓글 N` +1. 뒤로 가면 광장 카드도 +1(재조회 없이).
- 상세: 본인 댓글 `삭제` → `한 번 더` → 사라지고 카운트 -1. 나도 그럼 토글 → 뒤로 가서 광장 카드와 값 일치.
- 상세: 본인 밑줄이면 `삭제` → `한 번 더` → 광장으로 돌아가고 카드가 사라짐.
- 도서 상세(광장 카드 `책 보기 →` 또는 `/book/{id}`): 리뷰 섹션 제목이 `리뷰  밑줄` 두 글자 탭, 개수 없음, 기본 리뷰. `밑줄` 탭 → 조각 목록(문장·작성자·쪽·나도 그럼·댓글). 6건 이상이면 `밑줄 더 보기 →`. 조각 탭 → 상세.
- 도서 상세: 읽기 기록이 있는 책에서 `밑줄` 탭의 `오려두기 →` → 인라인 폼 → 등록 → 목록 맨 위에 새 밑줄. 기록 없는 책은 액션이 없음. 탭 전환 시 열린 폼이 닫힘.
- 라이트 모드(프로필에서 테마 전환)에서 탭·카드·입력 바 색이 어긋나지 않음.
- 없는 밑줄 `/quote/999999999` → "밑줄을 불러오지 못했습니다 · 지워졌거나 없는 밑줄입니다."

- [ ] **Step 3: 최종 typecheck·백엔드 테스트**

Run: `npm run typecheck 2>&1 | tail -2` → 에러 없음.
Run: `cd /d/Develop/workspace/myproject/project-bookey-backend/.worktrees/quote-comments/server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw test 2>&1 | grep -E "Tests run:|BUILD" | tail -2` → `Tests run: 100, Failures: 0, Errors: 0` · `BUILD SUCCESS`.

- [ ] **Step 4: 서버·웹 종료, 브랜치 마무리**

백그라운드 작업(:8090 서버, :8081 웹)을 멈춘다. 이후 `superpowers:finishing-a-development-branch` 로 두 저장소를 각각 main 에 머지(no-ff)하고 `feature/quote-comments` 브랜치·worktree 를 정리한다. 앱 main 에 머지할 때 다른 세션의 dirty 파일(`app/book/[id].tsx` 등)이 공유 트리에 있으면 **머지는 worktree 가 아닌 main 체크아웃에서** 해야 하므로, 그 세션 작업이 커밋될 때까지 기다리거나 사용자에게 알린다.
