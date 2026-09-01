# 도서 좋아요 · 상세 빠른 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙(`docs/superpowers/specs/2026-09-01-book-like-quick-add-design.md`)대로 좋아요 기능을 백엔드에 신설하고, 도서 상세 히어로 아래 3버튼 액션 바(♥ 좋아요 · + 읽고 싶은 · ▶ 읽기 시작)를 붙인다.

**Architecture:** 백엔드(Task 1): V6 `book_likes` + `BookLike` 도메인 + `POST /api/v1/books/{bookId}/like` 토글 + `BookDetail`에 `liked`/`likeCount` additive 확장(detail에 사용자 주입). 앱(Task 2~3): 타입 재생성·클라이언트 확장 → 상세 화면 `ActionBar` 로컬 컴포넌트(담기 성공 시 응답 record id를 로컬 상태로 채택해 진척 카드 즉시 전환).

**Tech Stack:** Spring Boot 4.1/Java 21/Flyway · Expo RN + react-query. 새 의존성 없음.

## Global Constraints

- **커밋 규칙**: AI 어트리뷰션 금지, 첫 줄 "신규:"/"수정:" 접두 + 한국어.
- 백엔드 Maven: `JAVA_HOME='C:\Users\ANT010\.jdks\corretto-21.0.7'` 프리픽스 필수. 저장소 위치 `D:\Develop\workspace\myproject\project-bookey-backend`, 앱은 `...\project-bookey-app`.
- 스키마 이름 `BookLikeView`·`BookDetail` 필드는 앱 코드젠 계약 — 확정 후 변경 금지. `BookDetail` 변경은 additive만.
- 엔티티 스타일: 클래스 레벨 `@Builder` 금지 — `@Builder`는 필드 제한 private 생성자에 (ReadingRecord 관례).
- 앱 검증 게이트: `npm run typecheck`. 백엔드: `./mvnw test` 회귀(73/73).

---

### Task 1 (백엔드): book_likes + 토글 API + BookDetail 확장

**Files:**
- Create: `server/src/main/resources/db/migration/V6__book_likes.sql`
- Create: `server/src/main/java/app/bookey/domain/like/BookLike.java`
- Create: `server/src/main/java/app/bookey/domain/like/BookLikeRepository.java`
- Modify: `server/src/main/java/app/bookey/api/book/dto/BookDtos.java` (`BookDetail` 필드 2개 추가 + `BookLikeView` 추가)
- Modify: `server/src/main/java/app/bookey/api/book/BookService.java` (`detail` 시그니처 확장 + `toggleLike`)
- Modify: `server/src/main/java/app/bookey/api/book/BookController.java` (detail에 유저 주입 + like 엔드포인트)

**Interfaces:**
- Produces: `POST /api/v1/books/{bookId}/like` → `BookLikeView(boolean liked, long likeCount)`, `BookDetail(..., boolean liked, long likeCount)` — Task 2의 코드젠이 소비.

- [ ] **Step 1: V6 마이그레이션**

```sql
-- 도서 좋아요 (스펙: app 저장소 2026-09-01-book-like-quick-add-design.md)
CREATE TABLE book_likes (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id    BIGINT NOT NULL REFERENCES books(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, book_id)
);
CREATE INDEX idx_book_likes_book ON book_likes(book_id);
```

- [ ] **Step 2: 엔티티·리포지토리**

`BookLike.java`:

```java
package app.bookey.domain.like;

import app.bookey.common.support.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 도서 좋아요 — 서재와 무관한 가벼운 반응. user_id+book_id 당 1건. */
@Getter
@Entity
@Table(name = "book_likes")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BookLike extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "book_id", nullable = false)
    private Long bookId;

    @Builder
    private BookLike(Long userId, Long bookId) {
        this.userId = userId;
        this.bookId = bookId;
    }
}
```

주의: `BaseTimeEntity`가 `updated_at`도 매핑한다면 V6에 `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` 컬럼을 추가해야 `ddl-auto: validate`가 통과한다 — `BaseTimeEntity.java`를 확인하고 필요 시 마이그레이션에 한 줄 추가.

`BookLikeRepository.java`:

```java
package app.bookey.domain.like;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BookLikeRepository extends JpaRepository<BookLike, Long> {
    Optional<BookLike> findByUserIdAndBookId(Long userId, Long bookId);
    long countByBookId(Long bookId);
    boolean existsByUserIdAndBookId(Long userId, Long bookId);
}
```

- [ ] **Step 3: DTO·서비스·컨트롤러**

`BookDtos.java` — `BookDetail`을 다음으로 교체(필드 2개 additive):

```java
    public record BookDetail(
            @NotNull BookSummary book,
            String description,
            RatingSummary verifiedRating,
            RatingSummary overallRating,
            long verifiedReviewCount,
            boolean liked,
            long likeCount
    ) {}
```

홀더에 추가:

```java
    /** 좋아요 토글 결과. */
    public record BookLikeView(boolean liked, long likeCount) {}
```

`BookService.java` — `BookLikeRepository bookLikeRepository` 필드 추가, `detail`을 사용자 인지형으로 교체:

```java
    @Transactional(readOnly = true)
    public BookDetail detail(Long userId, Long bookId) {
        Book book = getBook(bookId);
        return new BookDetail(
                BookSummary.from(book),
                book.getDescription(),
                toRating(reviewRepository.verifiedRating(bookId)),
                toRating(reviewRepository.overallRating(bookId)),
                toRating(reviewRepository.verifiedRating(bookId)).count(),
                bookLikeRepository.existsByUserIdAndBookId(userId, bookId),
                bookLikeRepository.countByBookId(bookId));
    }

    /** 좋아요 토글 — 있으면 해제, 없으면 등록. */
    @Transactional
    public BookLikeView toggleLike(Long userId, Long bookId) {
        getBook(bookId);
        var existing = bookLikeRepository.findByUserIdAndBookId(userId, bookId);
        boolean liked;
        if (existing.isPresent()) {
            bookLikeRepository.delete(existing.get());
            liked = false;
        } else {
            bookLikeRepository.save(BookLike.builder().userId(userId).bookId(bookId).build());
            liked = true;
        }
        return new BookLikeView(liked, bookLikeRepository.countByBookId(bookId));
    }
```

(import: `app.bookey.domain.like.BookLike`, `BookLikeRepository`, DTO의 `BookLikeView`.
`detail`의 다른 호출부가 있으면 컴파일 오류로 드러난다 — 확인 후 같은 방식으로 userId를 넘긴다.)

`BookController.java` — detail 교체 + 토글 추가 (`AuthUser` import는 기존 다른 컨트롤러 참조):

```java
    @Operation(summary = "도서 상세 — 검증 평점과 전체 평점을 분리해 제공")
    @GetMapping("/{bookId}")
    public BookDetail detail(@AuthenticationPrincipal AuthUser user, @PathVariable Long bookId) {
        return bookService.detail(user.id(), bookId);
    }

    @Operation(summary = "좋아요 토글")
    @PostMapping("/{bookId}/like")
    public BookLikeView like(@AuthenticationPrincipal AuthUser user, @PathVariable Long bookId) {
        return bookService.toggleLike(user.id(), bookId);
    }
```

- [ ] **Step 4: 테스트 회귀 + 커밋**

Run: `cd /d/Develop/workspace/myproject/project-bookey-backend/server && JAVA_HOME='C:\Users\ANT010\.jdks\corretto-21.0.7' ./mvnw test`
Expected: 73/73 PASS.

```bash
git add server/src/main/resources/db/migration/V6__book_likes.sql server/src/main/java/app/bookey/domain/like server/src/main/java/app/bookey/api/book
git commit -m "신규: 도서 좋아요 — book_likes 테이블·토글 API·상세 응답 확장"
```

---

### Task 2 (앱): 타입 재생성 + 클라이언트 확장

**Files:**
- Modify: `src/api/generated.ts` (`npm run types`) · `src/api/types.ts` · `src/api/endpoints.ts`

**Interfaces:**
- Consumes: Task 1의 OpenAPI 스키마 (백엔드 서버가 새 코드로 8080에 떠 있어야 함 — 컨트롤러가 재기동)
- Produces: `BookLikeView` 타입, `bookApi.like(bookId): Promise<BookLikeView>`, `bookApi.detail(bookId): Promise<BookDetail>` (생성 타입 사용)

- [ ] **Step 1: 재생성 + 별칭 + 클라이언트**

Run: `npm run types` → generated.ts에 `BookLikeView` 등장, `BookDetail`에 `liked`/`likeCount`.

`src/api/types.ts` 「도서 · 서재」 섹션에 추가:

```ts
export type BookLikeView = Schemas['BookLikeView'];
```

(`BookDetail` 별칭은 이미 존재 — 재생성으로 자동 갱신.)

`src/api/endpoints.ts` — `bookApi.detail` 반환 타입을 생성 별칭으로 교체하고 `like` 추가:

```ts
  detail: (bookId: number) => api<BookDetail>(`/api/v1/books/${bookId}`),
  like: (bookId: number) => api<BookLikeView>(`/api/v1/books/${bookId}/like`, { method: 'POST' }),
```

(import 목록에 `BookDetail`, `BookLikeView` 추가.)

- [ ] **Step 2: 타입 검사 + 커밋**

Run: `npm run typecheck` → exit 0

```bash
git add src/api/generated.ts src/api/types.ts src/api/endpoints.ts
git commit -m "수정: 좋아요 API 타입·클라이언트 추가"
```

---

### Task 3 (앱): 도서 상세 액션 바

**Files:**
- Modify: `app/book/[id].tsx`

**Interfaces:**
- Consumes: Task 2의 `bookApi.like`/`BookDetail`, 기존 `libraryApi.add`
- Produces: 최종 상세 화면 (♥·담기 2버튼·즉시 전환)

- [ ] **Step 1: rid 로컬 채택 구조로 변경**

화면 컴포넌트에서 기존 `const rid = recordId ? Number(recordId) : null;` 를 다음으로 교체
(`useState` import는 이미 있음):

```tsx
  const paramRid = recordId ? Number(recordId) : null;
  const [addedRid, setAddedRid] = useState<number | null>(null);
  const rid = paramRid ?? addedRid;
```

- [ ] **Step 2: ActionBar 로컬 컴포넌트 추가 + 히어로 아래 배치**

화면 JSX에서 `<Hero info={info} description={description} />` 바로 다음(sections View 첫 자식으로) 추가:

```tsx
        <ActionBar
          bookId={bookId}
          liked={book.data?.liked ?? false}
          likeCount={book.data?.likeCount ?? 0}
          hasRecord={rid != null}
          colors={colors}
          onAdded={setAddedRid}
        />
```

파일에 로컬 컴포넌트 추가 (KV 함수 근처):

```tsx
/** 히어로 아래 액션 바 — ♥ 좋아요(항상) + 서재에 없으면 담기 2버튼. */
function ActionBar({ bookId, liked, likeCount, hasRecord, colors, onAdded }: {
  bookId: number;
  liked: boolean;
  likeCount: number;
  hasRecord: boolean;
  colors: ColorTokens;
  onAdded: (recordId: number) => void;
}) {
  const queryClient = useQueryClient();

  const like = useMutation({
    mutationFn: () => bookApi.like(bookId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['book', bookId] }),
  });
  const add = useMutation({
    mutationFn: (status: ReadingStatus) => libraryApi.add({ bookId, status }),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      onAdded(record.id);
    },
  });
  const failed =
    (like.isError && !like.isPending) || (add.isError && !add.isPending);

  return (
    <View style={styles.actionBarWrap}>
      <View style={styles.actionBar}>
        <Pressable
          disabled={like.isPending}
          onPress={() => like.mutate()}
          accessibilityRole="button"
          accessibilityLabel="좋아요"
          style={[
            styles.likeButton,
            liked
              ? { backgroundColor: colors.accent }
              : { borderWidth: 1, borderColor: colors.lineStrong },
            { opacity: like.isPending ? 0.6 : 1 },
          ]}
        >
          <Text style={[typeScale.label, { color: liked ? colors.onAccent : colors.textMuted }]}>
            {liked ? '♥' : '♡'} {likeCount}
          </Text>
        </Pressable>

        {!hasRecord ? (
          <>
            <Pressable
              disabled={add.isPending}
              onPress={() => add.mutate('WANT_TO_READ')}
              accessibilityRole="button"
              accessibilityLabel="읽고 싶은 책으로 담기"
              style={[styles.quickAdd, { borderWidth: 1, borderColor: colors.accent, opacity: add.isPending ? 0.6 : 1 }]}
            >
              <Text style={[typeScale.label, { color: colors.accent }]}>+ 읽고 싶은</Text>
            </Pressable>
            <Pressable
              disabled={add.isPending}
              onPress={() => add.mutate('READING')}
              accessibilityRole="button"
              accessibilityLabel="읽기 시작"
              style={[styles.quickAdd, { backgroundColor: colors.accent, opacity: add.isPending ? 0.6 : 1 }]}
            >
              <Text style={[typeScale.label, { color: colors.onAccent }]}>▶ 읽기 시작</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      {failed ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>
          처리하지 못했어요 · 다시 시도
        </Text>
      ) : null}
    </View>
  );
}
```

import 조정: `bookApi`는 이미 import됨(`@/api/endpoints`), `ReadingStatus` 타입을 `@/api/types` import에 추가.

styles에 추가:

```tsx
  actionBarWrap: { gap: spacing.xs },
  actionBar: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  likeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAdd: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

- [ ] **Step 3: 타입 검사 + 커밋**

Run: `npm run typecheck` → exit 0

```bash
git add 'app/book/[id].tsx'
git commit -m "수정: 도서 상세에 좋아요·읽고 싶은·읽기 시작 액션 바 추가

담기 성공 시 응답 record id로 그 자리에서 진척 카드로 전환"
```

---

### Task 4: 스모크·육안 검증 (컨트롤러 수행)

- [ ] 백엔드 재기동(V6 적용 확인) → `POST /api/v1/books/1/like` 무인증 401(라우트 존재), OpenAPI에 `BookLikeView`.
- [ ] 웹 육안: ♥ 토글·카운트 증감, 서재에 없는 책에서 [+ 읽고 싶은]/[▶ 읽기 시작] → 진척 카드 즉시 등장, 서재 반영, 이미 담긴 책은 ♥만.
