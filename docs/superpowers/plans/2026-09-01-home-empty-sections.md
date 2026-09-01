# 홈 빈 섹션 표시 Implementation Plan

> **For agentic workers:** 소규모 단일 태스크 — 이 세션에서 직접 실행. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙(`docs/superpowers/specs/2026-09-01-home-empty-sections-design.md`)대로 빈 데이터에서도 배너·표지 행 4개가 섹션 골격을 유지하게 한다.

**Architecture:** 기존 홈 컴포넌트 3개의 빈 상태 분기만 수정 — 새 파일·새 의존성 없음. `BookRow`에 `onPressEmpty` prop 하나 추가(있으면 + 타일, 없으면 유령 표지), `BannerCarousel`은 `null` 대신 준비 중 스트립.

**Tech Stack:** Expo(RN) + TypeScript strict. 새 의존성 없음.

## Global Constraints

- **커밋 메시지에 AI 어트리뷰션 금지** (CLAUDE.md Git 규칙). 주석·커밋 메시지 한국어.
- 새 토큰만 사용: `useTheme`/`typeScale`/`spacing`/`radius`/`ornament`. ad-hoc 색·둥근 모서리 금지.
- 쿼리·라우팅 변경 없음.

---

### Task 1: 홈 빈 섹션 구현

**Files:**
- Modify: `src/components/home/BookRow.tsx`
- Modify: `src/components/home/BannerCarousel.tsx`
- Modify: `app/(tabs)/home.tsx`

- [ ] **Step 1: BookRow 빈 상태**
  - `if (!loading && books.length === 0) return null` 제거, `const empty = !loading && books.length === 0`.
  - prop `onPressEmpty?: () => void` 추가.
  - 헤더의 "전체보기 ›"는 `!empty`일 때만.
  - `empty && onPressEmpty`: 점선 테두리(`colors.lineStrong`) 96×144 타일 1개 — "+"(`typeScale.title`) · "책 추가"(`typeScale.caption`), `accessibilityLabel="책 추가"`.
  - `empty && !onPressEmpty`: 점선 유령 표지 3장 + 아래 캡션 "아직 준비 중이에요"(`typeScale.caption`/`colors.textMuted`).
- [ ] **Step 2: BannerCarousel 준비 중 스트립** — `banners.length === 0`이면 CARD_H 높이 점선 카드(`colors.lineStrong`) 중앙에 `❧ 이벤트 준비 중`(`ornament.section`, `colors.textMuted`).
- [ ] **Step 3: home.tsx 연결** — 읽는 중·읽고 싶은 행에 `onPressEmpty={() => router.push('/search')}` 전달.
- [ ] **Step 4: 검증** — `npm run typecheck` exit 0.
- [ ] **Step 5: 커밋** — `git commit -m "홈 빈 섹션 골격 유지 (+ 타일·유령 표지·배너 준비 중 스트립)"`

---

### Task 2: 상시 검색 바 + 온보딩 히어로 제거 (후속 결정)

**Files:**
- Modify: `app/(tabs)/home.tsx` — 스크롤 맨 위에 가짜 검색 바(로컬 컴포넌트) 추가, 히어로 `onSearch` 제거
- Modify: `src/components/home/HeroContinue.tsx` — 온보딩 분기·`onSearch` prop 제거, `!record`면 `null`

- [ ] **Step 1: 검색 바** — hairline 테두리(`colors.lineStrong`)·`radius.md`, `⌕ 책 제목·저자 검색`, 탭 → `/search`.
- [ ] **Step 2: 히어로 정리** — 온보딩 빈 상태 삭제, 읽는 중 없으면 렌더 안 함. 로딩 스켈레톤 유지.
- [ ] **Step 3: 검증·커밋** — `npm run typecheck` exit 0 후 커밋.

---

### Task 3: 육안 검증 (컨트롤러 수행)

- [ ] `npm run web`에서 빈 계정 기준: 검색 바·배너 스트립·행 4개(+ 타일 2, 유령 2) 노출(히어로 없음), 검색 바·+ 타일 → 검색, 다크/라이트.
- [ ] 검증 후 main 머지 + 브랜치 삭제 (CLAUDE.md Git 규칙).
