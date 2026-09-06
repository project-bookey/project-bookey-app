# 독후감 본문 안에 오려둔 문장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 독후감 본문(`bodyMd`) 중간에 밑줄을 표시 한 줄로 끼워 넣고, 상세·미리보기에서 그 자리에 인용 카드가 그려지게 한다.

**Architecture:** 본문에 `〖오려둔 문장 {id}〗` 마커를 넣고, 첨부 목록(`quoteIds`)은 저장할 때 본문에서 파생한다. 렌더는 마커로 본문을 쪼개 글 조각은 기존 `PostMarkdown` 에, 마커 자리에는 `QuoteScrap` 에 넘기는 새 `PostBody` 가 맡는다. 서버 계약은 그대로 두고 발췌(`PostExcerpt`)에서만 마커를 걸러 낸다.

**Tech Stack:** Expo(React Native) + TypeScript strict · React Native `TextInput`(selection) · 백엔드 Spring Boot 4(Java 21, JUnit5 + AssertJ)

## Global Constraints

- 설계 문서: `docs/superpowers/specs/2026-09-04-inline-quotes-design.md`. 어긋나면 문서가 기준이다.
- 마커 문자열은 정확히 `〖오려둔 문장 {id}〗` — 여는 괄호 `〖`(U+3016), 닫는 괄호 `〗`(U+3017), 사이에 `오려둔 문장 ` + 10진수 id. 정규식 `/〖오려둔 문장 (\d+)〗/g`.
- 밑줄은 **본문 안에만** 둔다 — 작성 화면의 하단 '오려둔 문장' 섹션과 '떼기'는 없앤다. 상세의 본문 뒤 모음은 **마커가 소비하지 않은 밑줄에만** 남긴다(옛 글 호환).
- `quoteIds` 는 본문 마커에서 파생한다. 사용자가 마커를 지우면 첨부도 풀린다.
- 서버 계약(`CreatePostRequest`·`UpdatePostRequest`·`PostView`·`post_quotes`) 무변경. 백엔드는 `PostExcerpt` 만 고친다.
- 상한 `POST_QUOTE_MAX`(10) 유지. 초과하면 제출을 막고 캡션으로 알린다.
- 앱: 색은 `useTheme().colors`, 활자는 `typeScale` spread, `serif`/`mono` 는 `@/theme/tokens`. 모든 Pressable 에 `accessibilityRole` + 라벨. 웹은 `hitSlop` 무시 → 여백으로 36px 터치 상자. Pressable 중첩 금지.
- 주석·UI 카피는 한국어. 커밋 메시지는 `신규:` / `수정:` 으로 시작하고 **AI 어트리뷰션을 넣지 않는다**.
- 앱 검사는 `npm run typecheck`(0 에러)뿐이다. 백엔드는 `cd server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q test`.
- 작업 트리 `D:\Develop\workspace\myproject\project-bookey-app`(앱, 브랜치 `feature/inline-quotes-impl`), `D:\Develop\workspace\myproject\project-bookey-backend`(백엔드, 브랜치 `feature/post-excerpt-marker`). 커밋 직전 `git branch --show-current` 로 확인.
- 백엔드 서버는 `:8080` 에서 이미 돌고 있다(main). 앱 웹은 `:8081`. 스모크로 다시 띄울 때 이 둘을 죽이지 않는다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/components/post/quoteMarkers.ts` (신규) | 마커 문자열 만들기·찾기·본문 쪼개기. 순수 함수만, RN 의존 없음 |
| `src/components/post/PostBody.tsx` (신규) | 본문을 마커로 쪼개 글 조각은 `PostMarkdown`, 마커는 `QuoteScrap` 으로 렌더 |
| `app/post/new.tsx` (수정) | 커서 위치에 마커 삽입, 하단 첨부 섹션 제거, `quoteIds` 를 본문에서 파생 |
| `app/post/[id].tsx` (수정) | `PostMarkdown` → `PostBody`, 본문 뒤 모음은 남은 밑줄만 |
| `server/.../domain/post/PostExcerpt.java` (수정) | 발췌에서 마커 제거 |

---

## Task 1: 마커 유틸 (앱)

**Files:**
- Create: `src/components/post/quoteMarkers.ts`
- Test: 없음 — 이 저장소에 앱 테스트 러너가 없다. 검증은 Task 2 의 화면과 Task 5 스모크가 한다.

**Interfaces:**
- Produces:
  - `quoteMarker(quoteId: number): string` — `〖오려둔 문장 123〗`
  - `parseQuoteIds(md: string): number[]` — 등장 순서대로, 중복 제거
  - `splitByQuoteMarkers(md: string): BodySegment[]` — `type BodySegment = { kind: 'text'; text: string } | { kind: 'quote'; quoteId: number }`
  - `insertQuoteMarkers(md: string, at: number, quoteIds: number[]): { text: string; cursor: number }` — `at` 위치에 마커들을 넣고 새 커서 위치를 돌려준다

- [ ] **Step 1: 파일을 만든다**

`src/components/post/quoteMarkers.ts`:

```ts
/**
 * 독후감 본문 안의 '오려둔 문장' 표시.
 *
 * 본문은 마크다운 문자열 하나이고, 밑줄이 들어갈 자리는 `〖오려둔 문장 123〗` 한 줄로 남는다.
 * 첨부 목록(quoteIds)은 이 표시에서 파생하므로, 본문에서 표시를 지우면 첨부도 풀린다.
 */

/** 표시를 찾는 정규식 — 쓸 때마다 lastIndex 가 남지 않게 매번 새로 만든다. */
const MARKER = () => /〖오려둔 문장 (\d+)〗/g;

export type BodySegment =
  | { kind: 'text'; text: string }
  | { kind: 'quote'; quoteId: number };

/** 본문에 넣을 표시 문자열. */
export function quoteMarker(quoteId: number): string {
  return `〖오려둔 문장 ${quoteId}〗`;
}

/** 본문에 나온 순서대로 밑줄 id 를 모은다(같은 밑줄이 여러 번이면 첫 자리만). */
export function parseQuoteIds(md: string): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const match of md.matchAll(MARKER())) {
    const id = Number(match[1]);
    if (!Number.isSafeInteger(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** 본문을 글 조각과 표시로 쪼갠다. 빈 글 조각은 버린다. */
export function splitByQuoteMarkers(md: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let last = 0;
  for (const match of md.matchAll(MARKER())) {
    const start = match.index ?? 0;
    const text = md.slice(last, start);
    if (text.trim()) segments.push({ kind: 'text', text });
    segments.push({ kind: 'quote', quoteId: Number(match[1]) });
    last = start + match[0].length;
  }
  const tail = md.slice(last);
  if (tail.trim()) segments.push({ kind: 'text', text: tail });
  return segments;
}

/**
 * `at` 자리에 표시를 넣는다. 앞뒤로 빈 줄을 보장해 표시가 제 문단이 되게 하고,
 * 새 커서 자리(표시 뒤)를 함께 돌려준다.
 */
export function insertQuoteMarkers(
  md: string,
  at: number,
  quoteIds: number[],
): { text: string; cursor: number } {
  if (quoteIds.length === 0) return { text: md, cursor: at };
  const pos = Math.max(0, Math.min(at, md.length));
  const before = md.slice(0, pos);
  const after = md.slice(pos);
  const lead = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after.length === 0 || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const block = quoteIds.map(quoteMarker).join('\n\n');
  const text = `${before}${lead}${block}${trail}${after}`;
  return { text, cursor: before.length + lead.length + block.length };
}
```

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0

- [ ] **Step 3: 커밋**

```bash
git add src/components/post/quoteMarkers.ts
git commit -m "신규: 독후감 본문의 오려둔 문장 표시 유틸 — 찾기·쪼개기·끼워넣기"
```

---

## Task 2: 본문 렌더 컴포넌트 (앱)

**Files:**
- Create: `src/components/post/PostBody.tsx`

**Interfaces:**
- Consumes: Task 1 의 `splitByQuoteMarkers`, `BodySegment`
- Produces:
  - `PostBody({ md, quotes, onPressQuote }: { md: string; quotes: BookQuote[]; onPressQuote?: (quoteId: number) => void })`
  - `usedQuoteIds(md: string, quotes: BookQuote[]): Set<number>` — 마커가 실제로 소비한(= quotes 에 있는) id. 상세가 남은 밑줄을 고를 때 쓴다

- [ ] **Step 1: 파일을 만든다**

`src/components/post/PostBody.tsx`:

```tsx
import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import type { BookQuote } from '@/api/types';
import { PostMarkdown } from '@/components/post/PostMarkdown';
import { parseQuoteIds, splitByQuoteMarkers } from '@/components/post/quoteMarkers';
import { QuoteScrap } from '@/components/quote/QuoteScrap';
import { spacing } from '@/theme';

/** 표시가 가리키는 밑줄 중 실제로 그릴 수 있는 것 — 지워졌거나 남의 밑줄이면 빠진다. */
export function usedQuoteIds(md: string, quotes: BookQuote[]): Set<number> {
  const have = new Set(quotes.map((quote) => quote.id));
  return new Set(parseQuoteIds(md).filter((id) => have.has(id)));
}

/**
 * 독후감 본문 — 글 사이에 오려둔 문장이 끼어든다.
 *
 * 표시를 마크다운 파서에 태우지 않고 그 앞에서 쪼갠다. 라이브러리의 토큰 규칙에 얽히지 않고,
 * 표시가 가리키는 밑줄이 없으면 그 자리를 그냥 비울 수 있다.
 */
export function PostBody({ md, quotes, onPressQuote }: {
  md: string;
  quotes: BookQuote[];
  onPressQuote?: (quoteId: number) => void;
}) {
  const byId = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote] as const)), [quotes]);
  const segments = useMemo(() => splitByQuoteMarkers(md), [md]);
  let scrapIndex = 0;
  return (
    <View style={styles.root}>
      {segments.map((segment, i) => {
        if (segment.kind === 'text') {
          return <PostMarkdown key={`t${i}`} md={segment.text} />;
        }
        const quote = byId.get(segment.quoteId);
        if (!quote) return null;
        const rotate = scrapIndex++ % 2 === 0 ? -1 : 1;
        return (
          <QuoteScrap
            key={`q${i}`}
            quote={quote}
            rotate={rotate}
            onPress={onPressQuote ? () => onPressQuote(quote.id) : undefined}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
});
```

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0

- [ ] **Step 3: 커밋**

```bash
git add src/components/post/PostBody.tsx
git commit -m "신규: 독후감 본문 렌더 — 글 사이에 오려둔 문장 조각을 끼운다"
```

---

## Task 3: 상세 화면 (앱)

**Files:**
- Modify: `app/post/[id].tsx` — `PostMarkdown` 사용처(본문 ④)와 밑줄 모음(⑤)

**Interfaces:**
- Consumes: Task 2 의 `PostBody`, `usedQuoteIds`

- [ ] **Step 1: import 를 바꾼다**

`app/post/[id].tsx` 위쪽의 `import { PostMarkdown } from '@/components/post/PostMarkdown';` 를 지우고 아래를 넣는다(기존 `QuoteScrap` import 는 남은 밑줄 모음에서 계속 쓰므로 그대로 둔다):

```tsx
import { PostBody, usedQuoteIds } from '@/components/post/PostBody';
```

- [ ] **Step 2: 본문과 밑줄 모음을 바꾼다**

`{/* ④ 본문 */}` 부터 `{/* ⑤ ... */}` 블록 끝(`) : null}`)까지를 아래로 교체한다:

```tsx
      {/* ④ 본문 — 표시가 있는 자리에 오려둔 문장이 들어간다 */}
      <PostBody
        md={post.bodyMd}
        quotes={post.quotes}
        onPressQuote={(quoteId) => router.push(`/quote/${quoteId}`)}
      />

      {/* ⑤ 본문에 넣지 않은 밑줄 — 표시 없이 엮기만 하던 옛 글을 위해 남긴다 */}
      {leftoverQuotes.length > 0 ? (
        <View style={styles.quotes}>
          <Eyebrow plain>오려둔 문장 {leftoverQuotes.length}</Eyebrow>
          {leftoverQuotes.map((quote, i) => (
            <QuoteScrap
              key={quote.id}
              quote={quote}
              rotate={i % 2 === 0 ? -1 : 1}
              onPress={() => router.push(`/quote/${quote.id}`)}
            />
          ))}
        </View>
      ) : null}
```

- [ ] **Step 3: `leftoverQuotes` 를 만든다**

같은 컴포넌트 안, `return` 위(다른 `useMemo`/파생값이 있는 자리)에 넣는다. `useMemo` 를 아직 import 하지 않았으면 `react` 에서 추가한다:

```tsx
  // 본문 표시가 소비하지 않은 밑줄만 아래에 모은다 — 표시로 넣은 것을 두 번 보여주지 않는다.
  const leftoverQuotes = useMemo(() => {
    const used = usedQuoteIds(post.bodyMd, post.quotes);
    return post.quotes.filter((quote) => !used.has(quote.id));
  }, [post.bodyMd, post.quotes]);
```

`post` 가 `undefined` 일 수 있는 위치라면(로딩·오류 분기 앞) `post?.bodyMd ?? ''`, `post?.quotes ?? []` 로 방어하고 배열도 그렇게 계산한다.

- [ ] **Step 4: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0

- [ ] **Step 5: 커밋**

```bash
git add "app/post/[id].tsx"
git commit -m "수정: 독후감 상세를 PostBody 로 — 본문 안 조각, 남은 밑줄만 아래 모음"
```

---

## Task 4: 작성 화면 (앱)

**Files:**
- Modify: `app/post/new.tsx`

**Interfaces:**
- Consumes: Task 1 의 `insertQuoteMarkers`, `parseQuoteIds`; Task 2 의 `PostBody`

- [ ] **Step 1: import 를 정리한다**

`PostMarkdown` import 를 `PostBody` 로 바꾸고, 마커 유틸을 추가한다. 하단 섹션에서만 쓰던 `FootAction`·`QuoteScrap` import 는 이 태스크 끝에 쓰이지 않으면 지운다(타입 검사가 잡아 준다):

```tsx
import { PostBody } from '@/components/post/PostBody';
import { insertQuoteMarkers, parseQuoteIds } from '@/components/post/quoteMarkers';
```

- [ ] **Step 2: 커서 위치를 붙잡는다**

상태 선언부(`const [picking, setPicking] = useState(false);` 근처)에 넣는다:

```tsx
  // 표시를 넣을 자리 — 본문 칸에서 마지막으로 커서가 있던 곳. 기본은 글 끝이다.
  const [caret, setCaret] = useState<number | null>(null);
  const bodyRef = useRef<TextInput>(null);
```

`useRef` 와 `TextInput` 타입이 import 돼 있어야 한다(`react`, `react-native`).

본문 `TextInput` 에 아래 두 속성을 더한다:

```tsx
                  ref={bodyRef}
                  onSelectionChange={(e) => setCaret(e.nativeEvent.selection.start)}
```

- [ ] **Step 3: 첨부를 본문 삽입으로 바꾼다**

기존 `attach`/`detach` 함수를 아래로 교체한다:

```tsx
  // 시트에서 고른 문장을 커서 자리에 표시로 넣는다. 이미 본문에 있는 것은 건너뛴다.
  const insertQuotes = (nextIds: number[], known: BookQuote[]) => {
    setQuotes((prev) => {
      const byId = new Map([...prev, ...known].map((quote) => [quote.id, quote] as const));
      return nextIds.flatMap((id) => { const q = byId.get(id); return q ? [q] : []; });
    });
    const already = new Set(parseQuoteIds(bodyMd));
    const fresh = nextIds.filter((id) => !already.has(id));
    if (fresh.length === 0) return;
    const { text, cursor } = insertQuoteMarkers(bodyMd, caret ?? bodyMd.length, fresh);
    setBodyMd(text);
    setCaret(cursor);
  };
```

- [ ] **Step 4: 제출이 본문에서 첨부를 뽑게 한다**

`submit` 의 `base` 안 `quoteIds` 줄을 바꾼다:

```tsx
        quoteIds: parseQuoteIds(bodyMd),
```

- [ ] **Step 5: 상한을 본문 기준으로 막는다**

`canSubmit` 을 바꾼다:

```tsx
  const bodyQuoteIds = parseQuoteIds(bodyMd);
  const overQuoteMax = bodyQuoteIds.length > POST_QUOTE_MAX;
  // 올라가는 중인 사진만 붙잡는다 — 실패한 타일까지 막으면 저장소가 꺼진 동안 글을 아예 못 올린다.
  const canSubmit = title.trim().length > 0 && bodyMd.trim().length > 0 && !uploads.busy && !overQuoteMax;
```

- [ ] **Step 6: 본문 아래에 삽입 버튼을 둔다**

본문 섹션(③)의 `쓰기` 모드 안, 마크다운 힌트 `Text` 바로 아래에 넣는다:

```tsx
                <View style={styles.sectionHead}>
                  <Pressable
                    onPress={() => setPicking(true)}
                    accessibilityRole="button"
                    accessibilityLabel="오려둔 문장 넣기"
                    style={styles.insertQuote}
                  >
                    <Text style={[typeScale.monoLabel, { color: colors.accent }]}>+ 오려둔 문장</Text>
                  </Pressable>
                  <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                    {bodyQuoteIds.length}/{POST_QUOTE_MAX}
                  </Text>
                </View>
```

`styles` 에 더한다:

```tsx
  // 10px 모노 라벨이라 글자 상자만으로는 손가락이 닿지 않는다 — 웹은 hitSlop 을 무시하므로 여백으로 키운다.
  insertQuote: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm },
```

- [ ] **Step 7: 미리보기를 PostBody 로 바꾼다**

미리보기 `Card` 안의 `<PostMarkdown md={bodyMd} />` 를 바꾼다:

```tsx
                  <PostBody md={bodyMd} quotes={quotes} />
```

- [ ] **Step 8: 하단 첨부 섹션을 지운다**

`{/* ⑤ 오려둔 문장 ... */}` 주석부터 그 `</View>` 까지 통째로 지운다. 사진 섹션(④)이 마지막 필드 앞에 오게 된다.

- [ ] **Step 9: 시트 연결을 고친다**

`QuoteAttachSheet` 의 `selectedIds`·`onChange` 를 본문 기준으로 바꾼다:

```tsx
          selectedIds={bodyQuoteIds}
          onChange={insertQuotes}
```

- [ ] **Step 10: 상한 초과 안내를 붙인다**

제출 실패 캡션(`errorMessage`)을 그리는 자리 근처에, 초과일 때만 보이는 캡션을 더한다:

```tsx
      {overQuoteMax ? (
        <Text style={[typeScale.caption, styles.error, { color: colors.warn }]}>
          오려둔 문장은 {POST_QUOTE_MAX}개까지 넣을 수 있어요 · 지금 {bodyQuoteIds.length}개
        </Text>
      ) : null}
```

- [ ] **Step 11: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0. 남은 미사용 import(`FootAction`·`QuoteScrap`·`PostMarkdown`)가 있으면 지운다.

- [ ] **Step 12: 커밋**

```bash
git add app/post/new.tsx
git commit -m "수정: 독후감 작성 — 오려둔 문장을 커서 자리에 넣고 첨부는 본문에서 파생"
```

---

## Task 5: 웹 스모크 (앱)

**Files:**
- Create: `.superpowers/smoke-posts/inline-quotes-web.mjs` (git 무시 대상)

**Interfaces:**
- Consumes: Task 3·4 의 화면

- [ ] **Step 1: 서버를 띄운다**

백엔드 `:8080` 은 이미 떠 있다. 앱 웹만 확인용으로 띄운다(다른 포트를 쓰면 8081 에서 보고 있는 화면을 방해하지 않는다):

```bash
EXPO_PUBLIC_API_URL=http://localhost:8080 npx expo start --web --port 8099
```

`curl -s -o /dev/null -w "%{http_code}" http://localhost:8099` 가 200 이면 준비된 것이다.

- [ ] **Step 2: 시나리오를 돌린다**

Playwright(`file:///C:/Users/ANT010/AppData/Local/npm-cache/_npx/db89d7302a373f10/node_modules/playwright/index.mjs`)로 390×844 화면에서 확인한다. 로그인은 이메일 폼(`tester1@dev.local` / `password1234`, 버튼 라벨 `이메일로 로그인`).

확인할 것:
1. 광장 → `+ 독후감` → 제목·본문 입력 → 본문 가운데에 커서를 두고 `+ 오려둔 문장` → 시트에서 두 개 선택 → 완료 → **본문에 `〖오려둔 문장 …〗` 두 줄이 커서 자리에 들어갔는지**
2. 미리보기 탭 → 글 사이에 인용 카드 두 개가 보이는지
3. 올리기 → 상세에서 같은 순서로 카드가 보이고, 카드를 누르면 밑줄 상세로 가는지
4. 고치기 → 본문에서 마커 하나를 지우고 저장 → 상세에 카드가 하나만 남는지
5. 광장 카드·홈 '오려둔 글' 조각의 발췌에 `〖` 가 없는지 (Task 6 을 먼저 하지 않았다면 여기서 실패한다 — 그 사실을 보고서에 적는다)
6. 콘솔 에러 0

스크린샷은 `.superpowers/smoke-posts/inline-quotes-*.png` 로 남긴다. 끝나면 8099 프로세스를 종료한다(`netstat -ano | grep :8099` → `taskkill //F //PID <pid>`).

- [ ] **Step 3: 결과를 남긴다**

`.superpowers/sdd/inline-quotes-smoke.md` 에 항목별 통과/실패와 스크린샷 경로를 적는다. 실패가 있으면 재현 조작·기대·실제를 함께 적는다.

---

## Task 6: 발췌에서 표시 지우기 (백엔드)

**Files:**
- Modify: `server/src/main/java/app/bookey/domain/post/PostExcerpt.java`
- Test: `server/src/test/java/app/bookey/domain/post/PostExcerptTest.java`

**Interfaces:**
- Produces: 없음(기존 `PostExcerpt.of` 동작만 좁힌다)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`PostExcerptTest` 에 더한다:

```java
    @Test
    @DisplayName("오려둔 문장 표시는 통째로 지운다")
    void removesQuoteMarkers() {
        assertThat(PostExcerpt.of("앞 문장 〖오려둔 문장 123〗 뒤 문장", 100))
                .isEqualTo("앞 문장 뒤 문장");
    }

    @Test
    @DisplayName("표시만 있는 본문은 빈 문자열이 된다")
    void markerOnlyBodyBecomesEmpty() {
        assertThat(PostExcerpt.of("〖오려둔 문장 7〗", 100)).isEmpty();
    }
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q test -Dtest=PostExcerptTest`
Expected: 두 테스트 FAIL — 발췌에 `〖오려둔 문장 123〗` 이 그대로 남는다

- [ ] **Step 3: 규칙을 더한다**

`PostExcerpt` 의 패턴 선언부(`IMAGE` 옆)에 넣는다:

```java
    /** 본문 안 '오려둔 문장' 표시 — 발췌에는 남기지 않는다(앱이 그 자리에 인용 카드를 그린다). */
    private static final Pattern QUOTE_MARKER = Pattern.compile("〖오려둔 문장 \\d+〗");
```

`of(...)` 안, `IMAGE` 를 지우는 줄 바로 뒤에 넣는다:

```java
        text = QUOTE_MARKER.matcher(text).replaceAll(" ");
```

- [ ] **Step 4: 통과를 확인한다**

Run: `cd server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q test -Dtest=PostExcerptTest`
Expected: PASS

- [ ] **Step 5: 전체 테스트**

Run: `cd server && JAVA_HOME="C:/Users/ANT010/.jdks/corretto-21.0.7" ./mvnw -q test`
Expected: 실패 0

- [ ] **Step 6: 커밋**

```bash
git add server/src/main/java/app/bookey/domain/post/PostExcerpt.java server/src/test/java/app/bookey/domain/post/PostExcerptTest.java
git commit -m "수정: 독후감 발췌에서 오려둔 문장 표시를 지운다"
```

---

## Self-Review 결과

- **스펙 커버리지**: 저장 형식 → Task 1 · 쓰기 흐름 → Task 4 · 렌더 → Task 2·3 · 기존 글 호환 → Task 3(`leftoverQuotes`) · 백엔드 발췌 → Task 6 · 검증 → Task 5·6. 빠진 요구 없음.
- **타입 일관성**: `parseQuoteIds`·`splitByQuoteMarkers`·`insertQuoteMarkers`·`quoteMarker`·`usedQuoteIds`·`PostBody` 의 이름과 인자를 Task 1·2 에서 정의한 그대로 Task 3·4 가 쓴다.
- **알려진 순서 의존**: Task 5 의 확인 5번(발췌에 표시 없음)은 Task 6 이 끝나야 통과한다. 백엔드 변경이 앱과 독립이라 순서를 바꿔도 되며, Task 5 를 마지막에 돌리면 한 번에 확인된다.
