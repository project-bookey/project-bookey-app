# 홈 빈 섹션 표시 — 설계 문서

2026-09-01 · 브레인스토밍 세션에서 사용자와 함께 결정
전제: [홈 리디자인 스펙](2026-08-31-home-redesign-design.md)

## 목표

데이터가 없는 계정에서 홈이 온보딩 히어로 하나로 접히는 문제를 고친다. 배너·표지 행
4개(읽는 중·읽고 싶은·추천·인기)가 비어 있어도 섹션 골격을 항상 보여줘 화면 구성이
드러나게 한다. 히어로의 기존 온보딩 빈 상태는 그대로 둔다.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 빈 표지 행 — 사용자 행(읽는 중·읽고 싶은) | 서재와 같은 **+ 타일** 1개 → `/search` (시각 비교로 선택) |
| 빈 표지 행 — 서버 행(추천·인기) | 유령 표지 3장 + "아직 준비 중이에요" 캡션 |
| 빈 배너 | 같은 높이(108)의 점선 카드 "❧ 이벤트 준비 중" (숨김 대신 자리 유지) |
| 빈 행의 "전체보기 ›" | 숨김 — 빈 서재로 보내는 링크는 의미 없음 |

## 컴포넌트 변경

1. **`src/components/home/BookRow.tsx`**
   - 빈 배열일 때 `return null` 하던 분기를 제거하고 행 제목은 항상 렌더.
   - 새 prop `onPressEmpty?: () => void`:
     - **있으면**: 표지 크기(96×144) + 타일 1개 — 점선 테두리(`colors.lineStrong`) +
       중앙 "+"(`typeScale.title`) · "책 추가"(`typeScale.caption`), 서재 `AddTile`과 동일 문법.
       `accessibilityLabel="책 추가"`.
     - **없으면**: 점선 테두리 유령 표지 3장(배경 없음) + 행 아래
       `typeScale.caption`/`colors.textMuted`로 "아직 준비 중이에요".
   - 빈 상태에서는 `onPressAll`이 있어도 "전체보기 ›"를 렌더하지 않는다.
   - 로딩 스켈레톤 분기는 기존 그대로.
2. **`src/components/home/BannerCarousel.tsx`**
   - `banners.length === 0`이면 `null` 대신 CARD_H(108) 높이의 점선 테두리
     (`colors.lineStrong`) 카드 하나를 렌더, 중앙에 `colors.textMuted`로
     `❧ 이벤트 준비 중`(`ornament.section` 사용).
3. **`app/(tabs)/home.tsx`**
   - 읽는 중·읽고 싶은 행에 `onPressEmpty={() => router.push('/search')}` 전달.
   - 추천·인기 행은 prop 미전달 → 유령 표지 폴백. 그 외 변경 없음.

## 검증

- `npm run typecheck`.
- `npm run web` 육안: 빈 계정에서 배너 스트립·히어로 온보딩·행 4개(+ 타일 2, 유령 2)가
  모두 보이는지, + 타일 → 검색 이동, 데이터 있는 행은 기존과 동일한지, 다크/라이트.
- 테스트 스위트 없음 — 추가하지 않는다 (저장소 규칙).
