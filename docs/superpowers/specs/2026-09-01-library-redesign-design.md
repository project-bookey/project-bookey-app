# 서재 탭 OTT 리디자인 — 설계 문서

2026-09-01 · 브레인스토밍 세션에서 사용자와 함께 결정
전제: [디자인 토큰 스펙](2026-08-31-design-tokens-design.md) · [홈 리디자인 스펙](2026-08-31-home-redesign-design.md)

## 목표

서재 탭을 OTT 포스터 월(표지 그리드)로 다시 만든다. 기존 "세그먼트 필터 + 정보 리스트 +
하단 고정 버튼"을 대체하며, 레거시 호환 레이어를 벗어나는 두 번째 화면이 된다.
기존 화면에서 빠져 있던 **멈춤(PAUSED) 필터**를 이번에 추가한다.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 레이아웃 | 표지 그리드 3열 (시각 비교로 A안 선택) |
| 필터 | 넷플릭스식 칩 가로 스크롤 — 읽는 중·읽고 싶은·완독·멈춤(신규)·하차 + 카운트 |
| 책 추가 | 그리드 첫 타일 "+"(점선 테두리) → `/search`. 하단 고정 버튼 제거 |
| 셀 정보 | 표지가 주인공 — 진행률은 하단 미니 바, 세부 정보는 도서 상세가 담당 |

## 화면 구성 (위→아래)

1. **칩 필터 바** — 가로 스크롤. 칩 5개: `읽는 중 N · 읽고 싶은 N · 완독 N · 멈춤 N · 하차 N`
   (카운트는 `libraryApi.summary`). 활성 칩 = 밝은 배경(`colors.text`) + 어두운 글자(`colors.bg`),
   비활성 = `colors.lineStrong` 아웃라인 + `colors.textMuted` 글자. 기본 선택은 "읽는 중".
2. **표지 그리드** — `FlatList numColumns={3}`, 셀 간격 `spacing.sm`, 좌우 여백 `spacing.lg`,
   `layout.content` 최대 폭 유지. 셀 = 2:3 비율 표지(`radius.sm`) + 아래 제목 한 줄 캡션
   (`typeScale.caption`, `colors.textMuted`).
   - **첫 타일**: 점선 테두리(`colors.lineStrong`) + 중앙 "+" · "책 추가" — 탭 시 `/search`.
     현재 필터와 무관하게 항상 첫 셀.
   - 셀 탭 → `/book/{book.id}?recordId={record.id}` (기존 라우팅 유지).
3. **당겨서 새로고침** — 목록 + 요약 리페치.

## 셀 상태 표현

| 상태 | 표현 |
|---|---|
| 읽는 중 | 표지 하단 진행 바 오버레이 (홈 BookRow와 동일 문법 — 트랙 `rgba(0,0,0,0.45)`, 채움 `colors.accent`) |
| 멈춤 | 진행 바 + 표지 좌상단 "멈춤" 태그 (`colors.warn` 글자 / `colors.warnSoft` 배경) |
| 하차 | 표지 불투명도 0.4 + "하차" 태그 (`colors.textFaint` 글자 / `colors.surfaceRaised` 배경) |
| 완독 | 깨끗한 표지만 |
| 공통 | `round > 1`이면 우상단 "N회독" 뱃지(`colors.scrimDim` 배경 + 밝은 글자). 표지 없으면 `colors.surfaceRaised` 배경에 제목 텍스트 폴백 |

## 구조 · 데이터 · 상태

- **파일**: `app/(tabs)/library.tsx` 전면 재작성. 칩·그리드 셀·+ 타일은 화면 전용 로컬
  컴포넌트로 파일 안에 둔다 (별도 파일 분리는 재사용 수요가 생길 때 — YAGNI).
  새 토큰(`useTheme`/`typeScale`/`spacing`/`radius`/`layout`)만 사용, 레거시 import 0.
- **데이터**: 기존 쿼리 키 유지 — `['library', status]`, `['library', 'summary']` (홈·타이머와
  캐시 공유). `PAUSED`는 API가 이미 지원한다(`ReadingStatus`에 존재, 필터만 없었음).
- **상태**: 로딩 = 스켈레톤 타일 6개(`colors.surface`), 빈 = 새 토큰으로 재작성한 빈 상태
  (기존 문구 유지 — 하차 전용 문구 "하차도 기록입니다…" 포함) + "책 찾기" CTA.
  오류 = 빈 상태와 동일 처리(당겨서 새로고침으로 복구).
- **접근성**: 셀 Pressable에 `accessibilityRole="button"` + 제목 라벨, + 타일에 "책 추가" 라벨.

## 검증

- `npm run typecheck`.
- `npm run web`(8083) 육안: 칩 전환(5개 필터 각각), 멈춤 필터 동작, + 타일 → 검색,
  하차 흐림 + 태그, 회독 뱃지, 다크/라이트, 당겨서 새로고침.
- 테스트 스위트 없음 — 추가하지 않는다 (저장소 규칙).
