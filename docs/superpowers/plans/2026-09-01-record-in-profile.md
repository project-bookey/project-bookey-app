# 기록 탭 프로필 통합 Implementation Plan

> **For agentic workers:** 스펙(`docs/superpowers/specs/2026-09-01-record-in-profile-design.md`)이 구현 수준으로 상세함 — 이 세션에서 직접 실행. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** '기록' 탭을 없애고 스트릭·90일 히트맵·누적 통계를 프로필 '내 서재' 카드 바로 아래 '기록' 카드 하나로 통합한다 (홈/서재/모임/프로필 4탭).

**Architecture:** `profile.tsx`에 `statsApi.summary(90)` 쿼리와 테마 인식 '기록' 카드(스탯 행 → 히트맵+범례 → 누적)를 추가. 히트맵 램프는 `colors.accent` hex 알파 4단계로 파생(하드코딩 파란색 제거). 그 뒤 `record.tsx`와 탭 등록을 삭제한다.

## Global Constraints

- 커밋 메시지: AI 어트리뷰션 금지, 한국어, 신규/수정 접두어, 의미 단위 그룹핑.
- `ui.tsx`·다른 레거시 화면·크롬(블랙 고정) 변경 금지.
- 레거시 `colors`(`@/theme` 호환 레이어) import 금지 — 색은 전부 `useTheme()` 인라인 주입, 정적 `StyleSheet`는 레이아웃만.
- 정보 손실 없음: 스트릭 3종 · 히트맵+적음/많음 범례 · 누적 3종(총 독서시간/오늘/기록한 날) 전부 유지.

---

### Task 1: 프로필 '기록' 카드

**Files:**
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `statsApi.summary(90)` (`src/api/endpoints.ts:64`), `formatDuration`은 `@/components/ui` 것을 쓰지 않고 로컬 복사(레거시 의존 금지 — 순수 함수라 복사가 안전).

핵심 조각:

```tsx
const stats = useQuery({ queryKey: ['stats', 90], queryFn: () => statsApi.summary(90) });
```

'내 서재' 카드와 '재촉 톤' 사이. 로딩 중엔 null, 실패 시 카드+캡션, 성공 시 전체:

```tsx
{stats.isLoading ? null : (
  <Card>
    <Eyebrow>기록</Eyebrow>
    {stats.data ? (
      <>
        <View style={styles.statRow}>
          <StatCell label="현재 스트릭" value={`${stats.data.currentStreakDays}일`} />
          <VRule />
          <StatCell label="최장 스트릭" value={`${stats.data.longestStreakDays}일`} />
          <VRule />
          <StatCell label="이번 주" value={formatDuration(stats.data.weekDurationSec)} />
        </View>
        <Heatmap daily={stats.data.daily} />
        {/* 범례: 적음 □□□□□ 많음 — 레벨 [0, 0.2, 0.4, 0.6, 1].map(cellColor).
            기존 record.tsx의 [0, 0.25, 0.5, 0.75, 1]은 경계값(<) 탓에 최저 채움
            단계가 빠지고 최고 단계가 중복 — 이번에 바로잡는다. */}
        <Rule />
        <KeyValue label="총 독서시간" value={formatDuration(stats.data.totalDurationSec)} />
        <Rule />
        <KeyValue label="오늘" value={formatDuration(stats.data.todayDurationSec)} />
        <Rule />
        <KeyValue label="기록한 날" value={`${stats.data.daily.filter((d) => d.sessionCount > 0).length}일 / 90일`} />
      </>
    ) : (
      <Text style={[type.caption, { color: colors.textFaint, marginTop: spacing.sm }]}>
        통계를 불러오지 못했습니다.
      </Text>
    )}
  </Card>
)}
```

램프 — 테마 파생(스펙 '히트맵 램프' 절):

```tsx
function cellColor(ratio: number, colors: ColorTokens): string {
  if (ratio <= 0) return colors.line;
  if (ratio < 0.25) return `${colors.accent}40`;
  if (ratio < 0.5) return `${colors.accent}80`;
  if (ratio < 0.75) return `${colors.accent}BF`;
  return colors.accent;
}
```

`Heatmap`은 `record.tsx:77-120`의 주 단위 열 쌓기 로직을 그대로 이식하되 `max` 계산(`Math.max(1, ...daily.map(d => d.durationSec))`)을 내부로 옮기고 색만 위 함수로 교체. `StatCell`·`VRule`은 record.tsx의 것을 테마 인식 로컬 프리미티브로 이식(프로필 `CountCell`과 같은 Numeral 강조).

- [ ] **Step 1:** profile.tsx 수정 — 쿼리·기록 카드·Heatmap/StatCell/VRule/cellColor/formatDuration 로컬 추가
- [ ] **Step 2:** `npm run typecheck` exit 0, `grep "components/ui" app/(tabs)/profile.tsx` 무매치 유지
- [ ] **Step 3:** 커밋 `신규: 프로필에 기록 카드 추가 — 스트릭·히트맵·누적 통계`

### Task 2: 기록 탭 삭제

**Files:**
- Delete: `app/(tabs)/record.tsx`
- Modify: `app/(tabs)/_layout.tsx` — `<Tabs.Screen name="record" ... />` 제거, 상단 주석 "MVP 5탭: 홈 / 서재 / 모임 / 기록 / 프로필" → "4탭: 홈 / 서재 / 모임 / 프로필 (기록은 프로필로 통합 — 2026-09-01 스펙)"

- [ ] **Step 1:** 파일 삭제 + 탭 등록·주석 갱신
- [ ] **Step 2:** `npm run typecheck` exit 0
- [ ] **Step 3:** 커밋 `수정: 기록 탭 삭제 — 프로필 기록 카드로 통합`

### Task 3: 검증 (컨트롤러 수행)

- [ ] `npm run web`(8083, 백엔드 구동 필요): 다크·라이트 각각 프로필 기록 카드(스트릭 3종·틸 램프 히트맵·누적 3종) 확인, 탭바 4탭·기록 탭 부재 확인
- [ ] 이상 없으면 main 머지 + `feature/record-in-profile` 브랜치 삭제
