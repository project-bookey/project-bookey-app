# 홈 추천·인기 행 작가 표시 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 "추천"·"인기" 행의 표지 아래에 제목 + 작가 2줄을 항상 표시한다.

**Architecture:** 공용 캐러셀 컴포넌트 `BookRow`의 항목 타입에 `author?`를 추가하고, 값이 있을 때만 작가 줄을 렌더한다. 홈 화면은 추천·인기 매핑에서만 `author`를 넘긴다. 서버 `BookSummary`에 `author`가 이미 있으므로 API 변경은 없다.

**Tech Stack:** Expo(React Native) + TypeScript strict, 디자인 토큰(`@/theme`).

**설계 문서:** `docs/superpowers/specs/2026-09-01-home-row-book-meta-design.md`

## Global Constraints

- 코드 주석·UI 문구는 한국어로 쓴다.
- 색·서체·간격은 `@/theme` 토큰만 쓴다 — 임의 색상·폰트 금지.
- 서버 응답 필드를 손으로 정의하지 않는다 (`BookSummary.author`는 생성 타입에 이미 존재).
- 커밋 메시지에 AI 어트리뷰션(Co-Authored-By 등)을 절대 넣지 않는다. 첫 줄은 `신규:`/`수정:`으로 시작한다.
- 검증 수단은 `npm run typecheck`가 유일하다 — 테스트 스위트·린트 없음.

---

### Task 1: BookRow 작가 줄 + 홈 매핑

**Files:**
- Modify: `src/components/home/BookRow.tsx` (타입 5–14행, import 3행, renderItem 97–99행, styles 108–148행)
- Modify: `app/home.tsx` (추천 매핑 101–106행, 인기 매핑 113–119행)

**Interfaces:**
- Consumes: `BookSummary.author?: string` (`src/api/generated.ts`의 생성 타입, 이미 존재)
- Produces: `RowBook.author?: string` — `BookRow`에 넘기면 표지 아래 작가 줄이 렌더된다. 넘기지 않으면 기존과 동일하게 제목만.

- [ ] **Step 1: `RowBook` 타입에 `author` 추가**

`src/components/home/BookRow.tsx`의 타입을 다음으로 바꾼다:

```tsx
export type RowBook = {
  key: string;
  bookId?: number;
  title: string;
  /** 표지 아래 작가 줄 — 없으면 줄 자체를 그리지 않는다 (추천·인기 행에서 사용) */
  author?: string;
  coverUrl?: string;
  /** 0~1 — 읽는 중 행의 진행률 오버레이 */
  progress?: number;
  /** 인기 행의 순위 (1부터) */
  rank?: number;
};
```

- [ ] **Step 2: import에 `sans` 추가**

같은 파일 3행을 다음으로 바꾼다:

```tsx
import { radius, sans, spacing, typeScale, useTheme } from '@/theme';
```

- [ ] **Step 3: renderItem의 제목 줄 강조 + 작가 줄 렌더**

같은 파일 renderItem 안의 기존 제목 `<Text>`(97–99행):

```tsx
<Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted, marginTop: spacing.xs, width: COVER_W }]}>
  {item.title}
</Text>
```

를 다음으로 바꾼다:

```tsx
<Text numberOfLines={1} style={[typeScale.caption, styles.metaTitle, { color: colors.text }]}>
  {item.title}
</Text>
{item.author ? (
  <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textMuted }]}>
    {item.author}
  </Text>
) : null}
```

(제목 강조는 모든 행 공통 — 행끼리 위계가 어긋나지 않게 한다. `width: COVER_W`는 부모 `styles.item`이 이미 잡고 있어 불필요하므로 제거.)

- [ ] **Step 4: styles에 `metaTitle` 추가**

같은 파일 `StyleSheet.create` 블록의 `item` 아래에 추가한다:

```tsx
metaTitle: { fontFamily: sans.semiBold, marginTop: spacing.xs },
```

- [ ] **Step 5: 홈 추천·인기 매핑에 `author` 전달**

`app/home.tsx`의 "추천" `BookRow` 매핑에 한 줄 추가:

```tsx
books={(recommended.data ?? []).map((b): RowBook => ({
  key: `pick-${b.id}`,
  bookId: b.id,
  title: b.title,
  author: b.author,
  coverUrl: b.coverUrl,
}))}
```

"인기" 매핑에도 한 줄 추가:

```tsx
books={(popular.data ?? []).map((p, i): RowBook => ({
  key: `popular-${p.book.id}`,
  bookId: p.book.id,
  title: p.book.title,
  author: p.book.author,
  coverUrl: p.book.coverUrl,
  rank: i + 1,
}))}
```

- [ ] **Step 6: 타입체크**

Run: `npm run typecheck`
Expected: 에러 0건, 출력 없이 종료.

- [ ] **Step 7: 웹 미리보기 확인**

Run: `npm run web` (백엔드 `:8080` 실행 중이어야 함) → http://localhost:8081 홈에서:
- "추천"·"인기" 행: 표지 아래 제목(밝은 색, semiBold) + 작가(회색) 2줄, 긴 작가명은 말줄임.
- "읽는 중"·"읽고 싶은" 행: 제목 한 줄만 (강조 스타일만 적용).
- 작가 없는 책: 작가 줄 없이 제목만.

- [ ] **Step 8: 커밋**

```bash
git add src/components/home/BookRow.tsx app/home.tsx
git commit -m "신규: 홈 추천·인기 행에 작가 표시"
```
