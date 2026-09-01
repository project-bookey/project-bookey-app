# 하단 탭 해체 · 헤더 내비게이션 — 설계 문서

2026-09-01 · 브레인스토밍 세션에서 사용자와 함께 결정
전제: [디자인 토큰](2026-08-31-design-tokens-design.md) · [홈](2026-08-31-home-redesign-design.md)

## 목표

하단 탭바를 제거하고 내비게이션을 재배치한다: 서재·프로필은 홈 헤더 우측 아이콘으로,
모임은 홈의 추천 모임 섹션으로. 홈이 앱의 유일한 허브가 된다.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 탭바 | 제거 — `(tabs)` 그룹 해체, 4개 화면을 루트 Stack으로 이동 |
| 헤더 아이콘 | 홈 헤더 우측: 종 🔔 · 서재 📚 · 프로필 👤 (좌→우) |
| 모임 진입 | 홈 맨 아래(인기 다음) 추천 모임 섹션 + 행 맨 끝 "+ 모임 만들기" 타일 |
| 이동 화면 내용 | 서재·모임·프로필 화면 코드는 이동만 — 내용 리디자인은 별도 계획 |

## 라우트 구조

- 이동: `app/(tabs)/home.tsx` → `app/home.tsx` · `library.tsx` → `app/library.tsx` ·
  `clubs.tsx` → `app/clubs.tsx` · `profile.tsx` → `app/profile.tsx`.
  `app/(tabs)/_layout.tsx` 삭제.
- 루트 Stack(`app/_layout.tsx`)에 등록:
  - `home` — `headerTitle: ''`, `headerLeft`는 로고만(뒤로가기 없음 — 홈이 루트),
    `headerRight: <HomeHeaderIcons />`
  - `library` "서재" · `clubs` "모임" · `profile` "프로필" — 기본 서브 화면 문법
    (‹ 뒤로가기 + 로고, 기존 `HeaderBackLogo`)
- 참조 교체(5개 파일): `app/index.tsx`(리다이렉트 → `/home`), `app/login.tsx`,
  `src/components/LogoHome.tsx`(홈 이동 → `/home`), `app/(tabs)/home.tsx`(전체보기 →
  `/library`), `app/club/[id]/index.tsx`.
- 홈은 Stack 루트이므로 로고 탭 시 `router.navigate('/home')` — 스택이 홈으로 복귀.

## 헤더 아이콘 (`HomeHeaderIcons`)

- 구성(좌→우): 기존 `NotificationBell`(종+미열람 배지) · 서재 📚 → `/library` ·
  프로필 👤 → `/profile`. 간격 `spacing.md`, hitSlop 8, `accessibilityRole="button"` +
  라벨("서재"/"프로필").
- 홈 화면에만 적용. 다른 화면 헤더는 기존 그대로(우측 없음).

## 추천 모임 섹션 (`ClubRow`)

- 위치: 홈 맨 아래(인기 행 다음). 섹션 제목 "추천 모임", 헤더 액션 "전체보기 ›" → `/clubs`.
- 데이터: `clubApi.publicClubs()` (`Page<ClubPreview>`), 쿼리 키 `['clubs', 'public']`.
- 카드(가로 캐러셀): 책 표지(52×78, 없으면 제목 폴백) + 모임명(1줄) + `인원 N/M` +
  상태 뱃지(RECRUITING="모집 중" `accent`/`accentSoft`, ACTIVE="진행 중" `textMuted`/`surfaceRaised`,
  그 외 상태는 목록에서 제외).
- 카드 탭: `alreadyMember`면 `/club/{id}`, 아니면 `/clubs`(참가 플로우가 있는 기존 화면).
- **행 맨 끝은 항상 "+ 모임 만들기" 점선 타일** → `/club/create` (서재 + 타일 문법).
  공개 모임 0건·오류여도 섹션은 + 타일과 함께 유지된다 — 탭 제거 후 유일한 생성 진입점.
- 로딩: 카드 스켈레톤 2개 + 타일.

## 구조 · 파일

- Create: `src/components/home/HomeHeaderIcons.tsx`, `src/components/home/ClubRow.tsx`
  (둘 다 새 토큰만 사용).
- Move: 위 라우트 구조 참조 (git mv — 화면 내용 무변경, import 경로만 조정).
- Modify: `app/_layout.tsx`(Stack 등록·홈 헤더), `app/home.tsx`(ClubRow 추가),
  참조 5개 파일의 경로 문자열.
- 모임·프로필 화면은 레거시 스타일 그대로 이동 — 과도기 규칙(스펙 `2026-08-31-design-tokens`) 유지.

## 검증

- `npm run typecheck`.
- 웹 육안: 탭바 사라짐, 헤더 아이콘 3종 진입·뒤로가기 복귀, 홈 추천 모임 카드·+ 타일·전체보기,
  로그인 → `/home` 리다이렉트, 로고 탭 홈 복귀, 다크/라이트.
- 테스트 스위트 없음 — 추가하지 않는다.
