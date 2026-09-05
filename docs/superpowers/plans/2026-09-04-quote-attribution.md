# 남의 밑줄 인용과 출처 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 독후감에 남이 오려둔 문장도 인용할 수 있게 하고, 남의 문장이면 인용 카드에 작성자를 밝힌다.

**Architecture:** 서버는 첨부 검증에서 "전부 내 것" 조건만 없앤다(존재 검사는 유지). 앱은 밑줄 고르기 시트에 범위 칩 셋(내 밑줄·이 책·광장)을 두고, 광장 응답(`PlazaItemView`)은 `BookQuote` 모양으로 옮겨 같은 목록·검색·선택 코드를 그대로 쓴다. 출처는 `QuoteScrap` 의 `showAuthor` 로 켠다.

**Tech Stack:** Expo(React Native) + TypeScript strict · TanStack Query · 백엔드 Spring Boot 4(Java 21, JUnit5 + AssertJ)

## Global Constraints

- 설계 문서: `docs/superpowers/specs/2026-09-04-quote-attribution-design.md`. 어긋나면 문서가 기준이다.
- 밑줄은 이미 전면 공개다(광장 피드·책 상세가 모두의 밑줄을 보여준다). 이 작업은 공개 범위를 새로 만들지 않는다.
- 출처 표기: 남의 문장이면 메타 맨 앞에 `{authorNickname}님`, 내 문장이면 붙이지 않는다. 판정은 서버가 준 `quote.mine`.
- 시트 범위 기본값은 `내 밑줄`. `이 책` 칩은 글에 책을 골랐을 때만 보인다. 범위를 바꿔도 검색어는 유지한다.
- 광장 범위에서 완독 자랑(`type !== 'QUOTE'`, `quoteId`/`content` 없음)은 목록에서 제외한다.
- 앱: 색은 `useTheme().colors`, 활자는 `typeScale` spread, `serif`/`mono` 는 `@/theme/tokens`. 모든 Pressable 에 `accessibilityRole` + 라벨. 웹은 `hitSlop` 무시 → 여백으로 36px 터치 상자. Pressable 중첩 금지(`QuoteScrap` 은 자체 Pressable 을 가진다).
- 주석·UI 카피는 한국어. 커밋 메시지는 `신규:` / `수정:` 으로 시작하고 **AI 어트리뷰션을 넣지 않는다**.
- 앱 검사는 `npm run typecheck`(0 에러)뿐. 백엔드는 `cd server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q test`.
- 작업 트리: 앱 `D:\Develop\workspace\myproject\project-bookey-app`(브랜치 `feature/quote-attribution`), 백엔드 `D:\Develop\workspace\myproject\project-bookey-backend`(브랜치 `feature/quote-attach-others`). 커밋 직전 `git branch --show-current` 확인.
- 백엔드 `:8080` 은 이미 떠 있다. **죽이지 않는다.** 앱 웹 확인은 `:8099` 로 띄우고 끝나면 종료한다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `server/.../api/post/PostService.java` (수정) | 첨부 검증에서 소유 조건 제거 |
| `server/.../api/post/PostServiceTest.java` (수정) | 남의 밑줄 허용·없는 id 거부 |
| `src/components/quote/QuoteScrap.tsx` (수정) | `showAuthor` 로 작성자 표기 |
| `src/components/post/quoteScope.ts` (신규) | 광장 응답 → `BookQuote` 변환, 범위 타입 |
| `src/components/post/QuoteAttachSheet.tsx` (수정) | 범위 칩 셋 · 범위별 목록 · 출처 표시 |
| `src/components/post/PostBody.tsx` · `app/post/new.tsx` (수정) | 인용 카드에 `showAuthor` 켜기 |

---

## Task 1: 서버 — 남의 밑줄 허용

**Files:**
- Modify: `server/src/main/java/app/bookey/api/post/PostService.java`
- Test: `server/src/test/java/app/bookey/api/post/PostServiceTest.java`

**Interfaces:**
- Produces: `static void validateQuoteAttachments(List<Long> requestedIds, List<BookQuote> found)` — `userId` 인자가 사라진다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`PostServiceTest` 의 기존 `validateQuoteAttachments` 테스트 옆에 더한다. 기존 테스트가 `userId` 를 넘기고 있으면 이 단계에서 함께 새 시그니처로 고친다(그래야 컴파일된다).

```java
    @Test
    @DisplayName("남이 오려둔 밑줄도 붙일 수 있다")
    void allowsOthersQuotes() {
        BookQuote mine = quote(1L, 10L);
        BookQuote others = quote(2L, 99L);

        assertThatCode(() -> PostService.validateQuoteAttachments(List.of(1L, 2L), List.of(mine, others)))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("없는 밑줄이 섞이면 거부한다")
    void rejectsMissingQuote() {
        BookQuote mine = quote(1L, 10L);

        assertThatThrownBy(() -> PostService.validateQuoteAttachments(List.of(1L, 2L), List.of(mine)))
                .isInstanceOf(ApiException.class);
    }
```

`quote(id, userId)` 헬퍼가 이미 있으면 그대로 쓰고, 없으면 파일의 기존 헬퍼 관례(리플렉션 id 주입)를 따라 만든다. `assertThatCode` 는 `org.assertj.core.api.Assertions` 에서 가져온다.

- [ ] **Step 2: 실패를 확인한다**

Run: `cd server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q test -Dtest=PostServiceTest`
Expected: 컴파일 실패(인자 개수 불일치) 또는 `allowsOthersQuotes` FAIL

- [ ] **Step 3: 검증을 고친다**

`PostService.validateQuoteAttachments` 를 바꾼다:

```java
    /** 요청한 밑줄이 모두 존재해야 한다. 밑줄은 공개물이라 남의 문장도 인용할 수 있다. */
    static void validateQuoteAttachments(List<Long> requestedIds, List<BookQuote> found) {
        Set<Long> foundIds = found.stream().map(BookQuote::getId).collect(Collectors.toSet());
        if (!foundIds.containsAll(requestedIds)) {
            throw new ApiException(ErrorCode.INVALID_REQUEST, "없는 밑줄은 붙일 수 없습니다.");
        }
    }
```

호출부(`attachQuotes`)에서 `userId` 인자를 뺀다:

```java
        validateQuoteAttachments(ids, quoteRepository.findAllById(ids));
```

`attachQuotes` 의 `userId` 매개변수가 다른 곳에서 안 쓰이면 함께 정리하고, 쓰이면 그대로 둔다. 컴파일러가 알려 준다.

- [ ] **Step 4: 통과를 확인한다**

Run: `cd server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q test -Dtest=PostServiceTest`
Expected: PASS

- [ ] **Step 5: 전체 테스트**

Run: `cd server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q test`
Expected: 실패 0

- [ ] **Step 6: 커밋**

```bash
git add server/src/main/java/app/bookey/api/post/PostService.java server/src/test/java/app/bookey/api/post/PostServiceTest.java
git commit -m "수정: 독후감에 남이 오려둔 밑줄도 붙일 수 있게 — 존재만 검사"
```

---

## Task 2: 앱 — 출처 표시

**Files:**
- Modify: `src/components/quote/QuoteScrap.tsx`
- Modify: `src/components/post/PostBody.tsx`
- Modify: `app/post/new.tsx` (붙여 둔 조각을 그리는 자리)

**Interfaces:**
- Produces: `QuoteScrap` 에 `showAuthor?: boolean`(기본 `false`)

- [ ] **Step 1: `QuoteScrap` 에 prop 을 더한다**

props 목록에 더한다(`showBook` 옆):

```tsx
  /** 남의 문장이면 메타 맨 앞에 작성자를 밝힌다 — 독후감처럼 여러 사람의 문장이 섞이는 자리에서 켠다. */
  showAuthor?: boolean;
```

기본값을 구조 분해에 더한다: `showAuthor = false,`

메타 계산을 바꾼다:

```tsx
  // 메타 한 줄 — 작성자(남의 것일 때만)·책 제목·쪽수 중 있는 것만 ' · ' 로 잇는다.
  const meta = [
    showAuthor && !quote.mine ? `${quote.authorNickname}님` : null,
    showBook ? quote.bookTitle : null,
    quote.page != null ? `${quote.page}쪽` : null,
  ]
    .filter(Boolean)
    .join(' · ');
```

- [ ] **Step 2: 상세·미리보기에서 켠다**

`src/components/post/PostBody.tsx` 의 `QuoteScrap` 에 더한다:

```tsx
            showAuthor
```

- [ ] **Step 3: 작성 화면에서 켠다**

`app/post/new.tsx` 에서 붙여 둔 밑줄 조각을 그리는 `QuoteScrap` 이 있으면 같은 prop 을 더한다. 없으면(본문 표시 방식으로 바뀌어 조각을 안 그리면) 이 단계는 건너뛰고 보고서에 적는다.

- [ ] **Step 4: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0

- [ ] **Step 5: 커밋**

```bash
git add src/components/quote/QuoteScrap.tsx src/components/post/PostBody.tsx app/post/new.tsx
git commit -m "신규: 인용 카드에 남의 문장이면 작성자를 밝힌다"
```

---

## Task 3: 앱 — 광장 응답 변환

**Files:**
- Create: `src/components/post/quoteScope.ts`

**Interfaces:**
- Produces:
  - `type QuoteScope = 'MINE' | 'BOOK' | 'PLAZA'`
  - `plazaItemToQuote(item: PlazaItem, myId?: number): BookQuote | null` — 밑줄이 아닌 항목이면 `null`

- [ ] **Step 1: 파일을 만든다**

`src/components/post/quoteScope.ts`:

```ts
import type { BookQuote, PlazaItem } from '@/api/types';

/** 밑줄을 고르는 범위 — 내 것, 글에 고른 책, 광장 전체. */
export type QuoteScope = 'MINE' | 'BOOK' | 'PLAZA';

/**
 * 광장 피드 항목을 밑줄 모양으로 옮긴다.
 *
 * 광장은 밑줄과 완독 자랑을 같은 배열로 내려주므로 밑줄이 아닌 항목은 버린다.
 * `mine` 은 광장 응답에 없어 로그인한 사람과 작성자를 견줘 만든다.
 */
export function plazaItemToQuote(item: PlazaItem, myId?: number): BookQuote | null {
  if (item.type !== 'QUOTE' || item.quoteId == null || item.content == null) {
    return null;
  }
  return {
    id: item.quoteId,
    bookId: item.bookId,
    bookTitle: item.bookTitle,
    bookCoverUrl: item.bookCoverUrl,
    page: item.page,
    content: item.content,
    authorId: item.authorId,
    authorNickname: item.authorNickname,
    authorAvatarUrl: item.authorAvatarUrl,
    agreeCount: item.agreeCount ?? 0,
    agreedByMe: item.agreedByMe ?? false,
    mine: myId != null && item.authorId === myId,
    commentCount: item.commentCount ?? 0,
    createdAt: item.occurredAt,
  };
}
```

`BookQuote`·`PlazaItem` 의 실제 필드가 다르면(예: 이름이 바뀌었으면) 코드베이스를 따르고 보고서에 적는다.

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0 — `BookQuote` 의 모든 필수 필드가 채워졌는지 컴파일러가 확인해 준다

- [ ] **Step 3: 커밋**

```bash
git add src/components/post/quoteScope.ts
git commit -m "신규: 광장 밑줄을 고르기 목록에 쓸 모양으로 옮기는 변환"
```

---

## Task 4: 앱 — 시트 범위 칩 셋

**Files:**
- Modify: `src/components/post/QuoteAttachSheet.tsx`

**Interfaces:**
- Consumes: Task 3 의 `QuoteScope`·`plazaItemToQuote`; Task 2 의 `QuoteScrap showAuthor`

- [ ] **Step 1: 범위 상태로 바꾼다**

지금의 `const [onlyThisBook, setOnlyThisBook] = useState(false);` 와 `scoped` 를 지우고 넣는다:

```tsx
  // 어디서 찾을지 — 내 밑줄이 기본, 글에 책을 골랐으면 '이 책', 그리고 광장 전체.
  const [scope, setScope] = useState<QuoteScope>('MINE');
  const myId = useAuth((s) => s.user?.id);
  // 책을 뺐는데 '이 책'을 보고 있었다면 내 밑줄로 되돌린다.
  const activeScope: QuoteScope = scope === 'BOOK' && bookId == null ? 'MINE' : scope;
```

`useAuth` 는 `@/store/auth` 에서, `QuoteScope`·`plazaItemToQuote` 는 `@/components/post/quoteScope` 에서 가져온다.

- [ ] **Step 2: 범위별 질의로 바꾼다**

지금의 `useInfiniteQuery` 하나를 아래로 교체한다:

```tsx
  const list = useInfiniteQuery({
    queryKey:
      activeScope === 'PLAZA' ? PLAZA_QUOTES_KEY
        : activeScope === 'BOOK' ? bookQuotesKey(bookId as number)
          : MY_QUOTES_KEY,
    queryFn: ({ pageParam }) =>
      activeScope === 'PLAZA' ? plazaApi.feed('QUOTE', pageParam, PAGE_SIZE)
        : activeScope === 'BOOK' ? quoteApi.byBook(bookId as number, pageParam, PAGE_SIZE)
          : quoteApi.mine(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  // 광장은 완독 자랑이 섞여 오므로 밑줄만 골라 같은 모양으로 옮긴다.
  const items = useMemo(() => {
    const pages = list.data?.pages ?? [];
    if (activeScope === 'PLAZA') {
      return pages.flatMap((p) => (p.content ?? []) as PlazaItem[])
        .flatMap((item) => { const q = plazaItemToQuote(item, myId); return q ? [q] : []; });
    }
    return pages.flatMap((p) => (p.content ?? []) as BookQuote[]);
  }, [list.data, activeScope, myId]);
```

`plazaApi` 는 `@/api/endpoints`, `PlazaItem`·`BookQuote` 는 `@/api/types` 에서 가져온다. `bookQuotesKey` 는 `@/api/quoteCache` 에 이미 있다(도서 상세 밑줄 탭이 쓰는 키). `PLAZA_QUOTES_KEY` 는 `quoteCache.ts` 에 더한다:

```ts
/** 밑줄 고르기 시트의 '광장' 범위 — 광장 화면의 무한 피드와 캐시를 나눠 쓴다. */
export const PLAZA_QUOTES_KEY = ['plaza', 'QUOTE', 'picker'] as const;
```

타입이 갈리는 목록을 한 `useInfiniteQuery` 로 받으므로 제네릭이 맞지 않으면 `as` 로 좁히지 말고, 범위별 질의를 셋으로 나누고 `activeScope` 에 따라 `enabled` 를 주는 편을 택한다. 어느 쪽이든 `items` 는 `BookQuote[]` 여야 한다.

- [ ] **Step 3: 칩을 셋으로 바꾼다**

지금의 `이 책만` 칩 블록을 바꾼다:

```tsx
            <View style={styles.chips}>
              <Chip label="내 밑줄" active={activeScope === 'MINE'} onPress={() => setScope('MINE')} />
              {bookId != null ? (
                <Chip label="이 책" active={activeScope === 'BOOK'} onPress={() => setScope('BOOK')} />
              ) : null}
              <Chip label="광장" active={activeScope === 'PLAZA'} onPress={() => setScope('PLAZA')} />
            </View>
```

- [ ] **Step 4: 빈 상태 문구를 범위에 맞춘다**

`items.length === 0` 분기의 문구를 범위별로 가른다:

```tsx
              <Text style={[typeScale.caption, styles.centerText, { color: colors.textFaint }]}>
                {activeScope === 'MINE'
                  ? '아직 오려둔 문장이 없어요. 위에서 바로 오려 두세요.'
                  : activeScope === 'BOOK'
                    ? '이 책에 오려진 문장이 아직 없어요.'
                    : '광장에 올라온 문장이 아직 없어요.'}
              </Text>
```

- [ ] **Step 5: 목록 조각에 출처를 켠다**

목록의 `QuoteScrap` 에 `showAuthor` 를 더한다. 내 밑줄 범위에서는 어차피 전부 내 것이라 이름이 안 나온다.

- [ ] **Step 6: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0. 미사용 import(`myBookQuotesKey` 등)가 남았으면 지운다 — `tsconfig` 가 잡아 주지 않으니 직접 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add src/components/post/QuoteAttachSheet.tsx src/api/quoteCache.ts
git commit -m "신규: 밑줄 고르기 범위 — 내 밑줄·이 책·광장"
```

---

## Task 5: 웹 스모크

**Files:**
- Create: `.superpowers/smoke-posts/attribution-web.mjs` (git 무시 대상)

- [ ] **Step 1: 서버를 띄운다**

백엔드 `:8080` 은 이미 떠 있다(Task 1 을 머지했으면 재기동해 최신 코드로 만든다). 앱 웹은 확인용으로:

```bash
EXPO_PUBLIC_API_URL=http://localhost:8080 npx expo start --web --port 8099
```

- [ ] **Step 2: 시나리오를 돌린다**

Playwright(`file:///C:/Users/ANT010/AppData/Local/npm-cache/_npx/db89d7302a373f10/node_modules/playwright/index.mjs`), 390×844, 로그인 `tester1@dev.local` / `password1234`(버튼 `이메일로 로그인`).

준비: tester2 계정으로 밑줄을 하나 만들어 둔다(API: `POST /api/v1/auth/login` → `POST /api/v1/quotes`). 그래야 '광장'에 남의 문장이 보인다.

확인:
1. 작성 화면 → 하단 띠 `+ 오려둔 문장` → 시트에 칩 셋(`내 밑줄`·`이 책`·`광장`)이 보인다. 책을 안 골랐으면 `이 책` 이 없다.
2. `광장` 으로 바꾸면 tester2 의 문장이 보이고 메타에 `○○님 · 책 · 쪽` 이 나온다. 내 문장에는 이름이 없다.
3. 광장 목록에 **완독 자랑이 섞이지 않는다**(문장 없는 항목 없음).
4. 남의 문장을 골라 본문에 넣고 저장 → **400 없이 성공**.
5. 상세에서 그 인용 카드에 `○○님` 이 보이고, 눌러 밑줄 상세로 간다.
6. 범위를 바꿔도 검색어가 유지되고, 각 범위에서 검색이 걸린다.
7. 콘솔 에러 0.

스크린샷 `.superpowers/smoke-posts/attribution-*.png`. 끝나면 `:8099` 종료. 만든 글·밑줄은 정리한다.

- [ ] **Step 3: 결과를 남긴다**

`.superpowers/sdd/attribution-smoke.md` 에 항목별 통과/실패, 실패는 재현 조작·기대·실제.

---

## Self-Review 결과

- **스펙 커버리지**: 서버 검증 완화 → Task 1 · 출처 표시 → Task 2 · 광장 변환 → Task 3 · 범위 칩 셋과 빈 상태 → Task 4 · 검증 → Task 5. 빠진 요구 없음.
- **타입 일관성**: `QuoteScope`·`plazaItemToQuote` 를 Task 3 에서 정의하고 Task 4 가 그대로 쓴다. `showAuthor` 는 Task 2 에서 정의하고 Task 4 가 쓴다.
- **순서 의존**: Task 5 의 확인 4(저장 성공)는 Task 1 이 `:8080` 에 반영돼야 통과한다. Task 1 을 백엔드 main 에 머지하고 재기동한 뒤 Task 5 를 돌린다.
