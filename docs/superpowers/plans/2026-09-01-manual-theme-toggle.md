# 앱 내 수동 테마 전환 Implementation Plan

> **For agentic workers:** 스펙(`docs/superpowers/specs/2026-09-01-manual-theme-toggle-design.md`)이 구현 수준으로 상세함 — 이 세션에서 직접 실행. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로필 탭 '화면 테마' 세그먼트(시스템/라이트/다크, 기본 시스템)로 앱 내 테마 전환. `useTheme()` 시그니처 불변 — 호출부 변경 zero.

**Architecture:** 신규 zustand 스토어(`themePreference`, AsyncStorage 저장) → `useTheme()`이 선호를 우선 해석 → 루트 레이아웃 ready 게이트에서 auth와 병렬 복원. 프로필 화면은 레거시 `colors`를 버리고 테마 인식 로컬 프리미티브로 전환(`ui.tsx` 불변, 다크 픽셀 동일).

## Global Constraints

- 커밋 메시지: AI 어트리뷰션 금지, 한국어, 신규/수정 접두어, 의미 단위 그룹핑.
- `ui.tsx`·다른 레거시 화면·크롬(블랙 고정) 변경 금지.
- 프로필 다크 외관은 현재와 픽셀 동일(신규 '화면 테마' 섹션 제외) — 레거시 `type`(시스템 폰트) 유지, 색만 테마화.

---

### Task 1: 테마 선호 인프라

**Files:**
- Create: `src/store/themePreference.ts` — zustand + AsyncStorage(`bookey.themePreference`), `restore()` 허용값 검증·실패 무시, `setPreference()` 즉시 반영 + fire-and-forget 저장
- Modify: `src/theme/useTheme.ts` — d815a65의 다크 고정을 걷어내고 `preference === 'system' ? (scheme === 'light' ? 'light' : 'dark') : preference`
- Modify: `app/_layout.tsx` — `Promise.all([auth.restore(), theme.restore()])`
- Modify: `docs/superpowers/specs/2026-08-31-design-tokens-design.md` — '다크 고정' 후속 결정이 본 스펙으로 대체됐음을 주석

- [ ] **Step 1:** 위 4개 파일 작성·수정, `npm run typecheck` exit 0
- [ ] **Step 2:** 커밋 `신규: 앱 내 테마 선호 스토어 추가, useTheme이 선호를 우선 해석`

### Task 2: 프로필 테마 인식 전환 + '화면 테마' UI

**Files:**
- Modify: `app/(tabs)/profile.tsx` — 레거시 `colors`·`@/components/ui` import 제거. 로컬 테마 인식 프리미티브(Screen·Card·Eyebrow·KeyValue·Numeral·Rule·GhostButton·Toggle) + 알림 카드 아래 '화면 테마' 카드(세그먼트 3택 + "시스템은 기기 설정을 따릅니다.")

- [ ] **Step 1:** profile.tsx 재작성 — 정적 StyleSheet는 레이아웃만, 색은 `useTheme()` 인라인
- [ ] **Step 2:** `npm run typecheck` exit 0 + `grep "components/ui\|colors," profile.tsx` 무매치
- [ ] **Step 3:** 커밋 `수정: 프로필을 테마 인식으로 전환하고 화면 테마 세그먼트 추가`

### Task 3: 검증 (컨트롤러 수행)

- [ ] `npm run web`(8083): 프로필에서 3모드 전환 즉시 반영, 새로고침·로그아웃 후 유지, '시스템' 선택 시 `prefers-color-scheme` 추종, 다크에서 프로필 기존 모습 동일
- [ ] 이상 없으면 main 머지 + 브랜치 삭제
