# 검색 화면 OTT 리디자인 — 설계 문서

2026-09-01 · 브레인스토밍 세션에서 사용자와 함께 결정
전제: [디자인 토큰 스펙](2026-08-31-design-tokens-design.md) · [홈 리디자인 스펙](2026-08-31-home-redesign-design.md)

## 목표

검색 화면을 OTT 검색 문법으로 다시 만든다. 홈 최상단 상시 검색 바의 목적지이며,
레거시 호환 레이어를 벗어나는 세 번째 화면이 된다. 현행의 거친 동작
(행 탭 = 확인 없이 "읽는 중"으로 담고 화면 닫힘)을 고친다.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 탭 동작 | 행 탭 = 도서 상세(`/book/{id}`), 담기는 별도 버튼 |
| 담기 플로우 | "담기" 버튼 탭 → 그 자리가 "읽는 중 \| 읽고 싶은" 칩 2개로 인라인 전환 → 선택 시 해당 상태로 등록 → "담김 ✓"(비활성). 화면은 닫지 않는다(연속 담기) |
| 검색 방식 | 검색 버튼 제거 — 400ms 디바운스 실시간 검색, 최소 2자 |
| 초기 화면 | 인기·추천 `BookRow` 2행 (홈과 같은 컴포넌트·쿼리 키 재사용) |
| 결과 레이아웃 | 정보 리스트 유지 (쪽수·출판사 확인 + 담기 액션에 실용적) |
| 직접 등록 | 이번 스코프에서 제외 — 결과 없음 문구에서 "직접 등록" 언급 제거, 백로그로 |

## 화면 구성 (위→아래)

1. **검색 바** — 상단 고정. `surfaceRaised` 배경, `radius.md`, ⌕ 접두 글리프,
   `textFaint` 플레이스홀더("제목 · 저자 · ISBN"), autoFocus 유지.
   입력 400ms 디바운스 후 검색어 확정, `trim().length >= 2`일 때만 쿼리 실행.
2. **초기 상태** (확정 검색어 없음) — `@/components/home/BookRow` 2행:
   "추천"(`['home','recommended']`), "인기"(`['home','popular']` + 순위 뱃지) — 홈과 쿼리 키를
   공유해 캐시 재사용. 표지 탭 → `/book/{id}`. 행이 비면 일반 규칙대로 숨김.
3. **결과 리스트** — 행 구성:
   - 표지 52×78(`radius.sm`, 없으면 `surfaceRaised` + 제목 폴백)
   - 제목(`typeScale.bodyStrong`) / 저자·출판사(`typeScale.caption`, `textMuted`)
   - 쪽수 태그: 있으면 `"N쪽"`(`surfaceRaised` 배경), 없으면 `"쪽수 없음"`(`warn`/`warnSoft`)
   - 우측 담기 영역(3상태): ① "담기" 아웃라인 버튼(`accent` 글자·테두리) →
     ② 칩 2개 "읽는 중"/"읽고 싶은"(`accentSoft` 배경, 한 번 더 탭으로 확정; 다른 행의 담기를
     열면 이전 행은 ①로 복귀) → ③ 등록 성공 시 "담김 ✓"(`textFaint`, 비활성).
   - 행 탭 → `/book/{book.id}` (등록 전이므로 recordId 없음).
4. **결과 없음** — "결과가 없어요" + "다른 검색어로 시도해보세요." (직접 등록 문장 제거).
5. **로딩** — 결과 행 스켈레톤 3개(표지 자리 `surface`).

## 데이터 · 동작 규칙

- 검색 쿼리: `['books', keyword]` 유지, `queryFn: bookApi.search(keyword)`,
  `enabled: keyword.trim().length >= 2`. 홈 충돌은 이미 해소됨(홈은 `['home', …]`).
- 담기: `libraryApi.add({ bookId, status })` — status는 선택한 칩(READING | WANT_TO_READ).
  성공 시 `['library']` invalidate. **`router.back()` 호출하지 않는다.**
- 담기 진행 중(`isPending`)에는 해당 행 칩 비활성. 실패 시 ①로 복귀(다시 시도 가능).
- 같은 책을 다시 담으려는 경우의 서버 오류는 기존 `ApiError` 메시지 흐름에 맡긴다
  (별도 UI 없음 — YAGNI).

## 구조

- `app/search.tsx` 전면 재작성 — 검색 바·결과 행(3상태 담기 포함)은 화면 전용 로컬 컴포넌트.
  `BookRow`는 `@/components/home/BookRow`에서 그대로 import (폴더 이동 리팩터 없음 — YAGNI).
- 새 토큰(`useTheme`/`typeScale`/`spacing`/`radius`/`layout`)만 사용, 레거시 import 0.
- 디바운스는 `useEffect` + `setTimeout` 기반 (외부 유틸 의존성 추가 없음).

## 검증

- `npm run typecheck` + 레거시 import grep 무매치.
- 웹 육안: 디바운스 검색(2자 미만 무시), 초기 인기·추천 행, 행 탭 → 상세,
  담기 3상태 전환(칩 선택 → 담김 ✓ → 서재 반영), 결과 없음 문구, 다크/라이트.
- 테스트 스위트 없음 — 추가하지 않는다.
