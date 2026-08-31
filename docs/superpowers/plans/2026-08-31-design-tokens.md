# OTT 디자인 토큰 체계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙(`docs/superpowers/specs/2026-08-31-design-tokens-design.md`)의 OTT 디자인 토큰 체계를 `src/theme/`에 구축하고, 기존 13개 화면이 깨지지 않는 호환 레이어와 함께 다크/라이트 전환을 동작시킨다.

**Architecture:** 하나의 시맨틱 계약(`ColorTokens` 타입)을 다크/라이트 두 팔레트로 채우고, `useTheme()` 훅이 `useColorScheme()`을 읽어 활성 팔레트를 내려준다. 모드 무관 토큰(간격·반경·타이포·모션)은 정적 export. 기존 화면은 `index.ts`의 `@deprecated` 호환 레이어(다크 값 고정)로 과도기를 버틴다.

**Tech Stack:** Expo(React Native) + TypeScript strict. 새 런타임 의존성 없음. 테스트 스위트 없음 — `npm run typecheck`가 각 태스크의 게이트.

## Global Constraints

- 팔레트 hex 값은 스펙 표의 값을 그대로 쓴다 (임의 조정 금지).
- 새 런타임 의존성 추가 금지 (`expo-linear-gradient`도 이번 스코프에서는 추가하지 않는다 — `scrimStops` 토큰만 정의).
- 시스템 폰트를 쓴다 — 새 토큰에 `fontFamily`를 지정하지 않는다.
- 주석·커밋 메시지는 한국어 (저장소 관례).
- 테스트 프레임워크를 추가하지 않는다 (스펙의 검증 섹션).
- 각 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 푸터를 넣는다.
- 기존 화면이 실제로 쓰는 레거시 이름(2026-08-31 grep 결과): `colors.ink`(62) · `colors.surfaceAlt`(7) · `colors.trackEmpty`(4) · `type.subtitle`(8) · `type.eyebrow`(4) · `fonts`(7 파일) · `ornament` · `elevation.card` · 정적 `lagStyle`/`paceStyle`. 이들은 호환 레이어가 반드시 커버한다. `mono`와 `type.numeral`은 미사용 — 새 코드로 가져가지 않는다.

---

### Task 1: 모드 무관 토큰 (`tokens.ts`)

**Files:**
- Create: `src/theme/tokens.ts`

**Interfaces:**
- Consumes: 없음 (독립 파일)
- Produces: `spacing`, `radius`, `typeScale`, `motion`, `layout`, `hairline`, `statusLabel` — Task 4의 `index.ts`가 재수출하고, `typeScale`은 호환 레이어의 `type` 별칭 원본이 된다.

- [ ] **Step 1: tokens.ts 작성**

```ts
/**
 * bookey 디자인 토큰 — 모드(다크/라이트) 무관 값.
 *
 * 방향: 넷플릭스·디즈니+ 계열의 콘텐츠 플랫폼. 시스템 폰트에 크기·웨이트로만
 * 위계를 만들고, 형태는 샤프(2–4px)하게 유지한다.
 * 설계 문서: docs/superpowers/specs/2026-08-31-design-tokens-design.md
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16, // 화면 좌우 여백
  xl: 24, // 섹션 사이
  xxl: 36,
} as const;

/** 샤프 형태 언어. 원형(pill)은 아바타·토글 손잡이에만 — 버튼에 쓰지 않는다. */
export const radius = {
  none: 0,
  sm: 2, // 책 표지
  md: 4, // 카드·버튼·칩·입력
  lg: 8, // 시트·모달
  pill: 999,
} as const;

/** 타입 스케일. 시스템 폰트 — fontFamily 를 지정하지 않는다. */
export const typeScale = {
  /** 히어로 책 제목 */
  display: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  /** 화면 제목 */
  title: { fontSize: 22, fontWeight: '700' },
  /** 행(캐러셀) 머리글 */
  section: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  /** 버튼·탭·칩 */
  label: { fontSize: 13, fontWeight: '600' },
  /** 메타 정보 */
  caption: { fontSize: 12, fontWeight: '400' },
  /** 아이브로우 — 주로 악센트 색으로 쓴다 */
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
} as const;

/** 모션 지속시간(ms). 이징은 표준 ease-out. */
export const motion = {
  fast: 150, // 터치 피드백
  base: 250, // 화면 전환·페이드
  slow: 400, // 히어로·시트
} as const;

export const layout = {
  content: { maxWidth: 560, width: '100%' as const, alignSelf: 'center' as const },
} as const;

export const hairline = 1;

export const statusLabel: Record<string, string> = {
  WANT_TO_READ: '읽고 싶은',
  READING: '읽는 중',
  PAUSED: '멈춤',
  FINISHED: '완독',
  ABANDONED: '하차',
};
```

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck`
Expected: 오류 없이 종료 (exit 0). 기존 `src/theme/index.ts`는 아직 건드리지 않았으므로 화면들도 그대로 컴파일된다.

- [ ] **Step 3: 커밋**

```bash
git add src/theme/tokens.ts
git commit -m "OTT 토큰: 모드 무관 토큰 추가 (간격·반경·타이포·모션)"
```

---

### Task 2: 컬러 팔레트 (`palette.ts`)

**Files:**
- Create: `src/theme/palette.ts`

**Interfaces:**
- Consumes: 없음 (독립 파일, `react-native`의 `ViewStyle`만 import)
- Produces: `ColorTokens` 타입, `ThemeMode = 'dark' | 'light'`, `darkColors: ColorTokens`, `lightColors: ColorTokens`, `cardShadow: Record<ThemeMode, ViewStyle>`, `getLagStyle(colors: ColorTokens)`, `getPaceStyle(colors: ColorTokens)` — Task 3의 `useTheme`와 Task 4의 호환 레이어가 사용.

- [ ] **Step 1: palette.ts 작성**

```ts
import type { ViewStyle } from 'react-native';

/**
 * 컬러 팔레트. 하나의 시맨틱 계약(ColorTokens)을 다크/라이트 두 벌 값으로 채운다.
 * 한쪽에만 키를 추가하면 typecheck 가 실패한다 — 두 팔레트는 어긋날 수 없다.
 */
export type ColorTokens = {
  /** 화면 배경 */
  bg: string;
  /** 카드·행 */
  surface: string;
  /** 시트·모달·눌림 — 다크에서는 밝기가 곧 높이다 */
  surfaceRaised: string;
  text: string;
  textMuted: string;
  textFaint: string;
  /** 헤어라인·트랙 */
  line: string;
  /** 아웃라인 버튼 테두리 */
  lineStrong: string;
  /** CTA·진행 바·링크·긍정 상태 — 틸 하나로 통일 */
  accent: string;
  /** 악센트 배경 위 텍스트 */
  onAccent: string;
  /** 악센트 틴트 배경 (배지 등) */
  accentSoft: string;
  warn: string;
  warnSoft: string;
  danger: string;
  dangerSoft: string;
  /** 전면 딤 (모달 뒤) */
  scrimDim: string;
  /** 포스터 하단→투명 그라데이션 색 스톱. 렌더링은 화면 작업 때 expo-linear-gradient 로. */
  scrimStops: readonly [string, string];
};

export type ThemeMode = 'dark' | 'light';

export const darkColors: ColorTokens = {
  bg: '#141414',
  surface: '#1F1F1F',
  surfaceRaised: '#2A2A2A',
  text: '#F5F5F5',
  textMuted: '#A6A6A6',
  textFaint: '#737373',
  line: '#333333',
  lineStrong: '#4D4D4D',
  accent: '#1FC7A8',
  onAccent: '#0E1512',
  accentSoft: '#12352E',
  warn: '#F0B429',
  warnSoft: '#38290F',
  danger: '#FF6B60',
  dangerSoft: '#3A1714',
  scrimDim: 'rgba(0,0,0,0.55)',
  scrimStops: ['transparent', 'rgba(0,0,0,0.85)'],
};

export const lightColors: ColorTokens = {
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceRaised: '#F0F0F0',
  text: '#171717',
  textMuted: '#595959',
  textFaint: '#8C8C8C',
  line: '#E3E3E3',
  lineStrong: '#C7C7C7',
  accent: '#0E9F85',
  onAccent: '#FFFFFF',
  accentSoft: '#DFF7F1',
  warn: '#8A5A12',
  warnSoft: '#FDF0D5',
  danger: '#B3362B',
  dangerSoft: '#FBE4E1',
  scrimDim: 'rgba(0,0,0,0.45)',
  scrimStops: ['transparent', 'rgba(0,0,0,0.85)'],
};

/** 엘리베이션 — 다크는 밝기 단계로 대체(그림자 없음), 라이트만 카드 그림자 1종. */
export const cardShadow: Record<ThemeMode, ViewStyle> = {
  dark: {},
  light: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
};

/** 지연 단계(§F4) → 색. 팔레트를 따라가도록 함수로 제공한다. */
export function getLagStyle(colors: ColorTokens): Record<string, { label: string; fg: string; bg: string }> {
  return {
    L0_NORMAL: { label: '정상', fg: colors.textMuted, bg: colors.surfaceRaised },
    L1_CAUTION: { label: '주의', fg: colors.warn, bg: colors.warnSoft },
    L2_DELAYED: { label: '지연', fg: colors.warn, bg: colors.warnSoft },
    L3_SERIOUS: { label: '심각', fg: colors.danger, bg: colors.dangerSoft },
    L4_NEGLECTED: { label: '방치', fg: colors.danger, bg: colors.dangerSoft },
  };
}

/** 페이스 → 색. 긍정 상태는 악센트가 겸한다. */
export function getPaceStyle(colors: ColorTokens): Record<string, { label: string; fg: string; bg: string }> {
  return {
    ON_TRACK: { label: '순항', fg: colors.accent, bg: colors.accentSoft },
    BEHIND: { label: '뒤처짐', fg: colors.warn, bg: colors.warnSoft },
    AT_RISK: { label: '위험', fg: colors.danger, bg: colors.dangerSoft },
  };
}
```

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck`
Expected: exit 0. (두 팔레트가 `ColorTokens`를 만족하는지 이 단계에서 검증된다 — 키를 하나 빼고 저장해보면 즉시 오류가 나는 것을 확인해도 좋다.)

- [ ] **Step 3: 커밋**

```bash
git add src/theme/palette.ts
git commit -m "OTT 토큰: 다크/라이트 컬러 팔레트 추가"
```

---

### Task 3: 테마 훅 (`useTheme.ts`)

**Files:**
- Create: `src/theme/useTheme.ts`

**Interfaces:**
- Consumes: Task 2의 `darkColors`, `lightColors`, `cardShadow`, `ColorTokens`, `ThemeMode`
- Produces: `useTheme(): { mode: ThemeMode; colors: ColorTokens; cardShadow: ViewStyle }` — Task 4가 재수출, Task 5의 `app/_layout.tsx`가 첫 소비자.

- [ ] **Step 1: useTheme.ts 작성**

```ts
import { useColorScheme } from 'react-native';
import type { ViewStyle } from 'react-native';

import { cardShadow, darkColors, lightColors } from './palette';
import type { ColorTokens, ThemeMode } from './palette';

/**
 * 활성 테마를 내려주는 훅. 시스템 설정(useColorScheme)을 따르고,
 * 값이 없으면 다크(기본)로 폴백한다.
 * 앱 내 수동 테마 전환이 필요해지면 이 훅 내부만 바꾼다 — 호출부는 그대로.
 */
export function useTheme(): { mode: ThemeMode; colors: ColorTokens; cardShadow: ViewStyle } {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === 'light' ? 'light' : 'dark';
  return {
    mode,
    colors: mode === 'light' ? lightColors : darkColors,
    cardShadow: cardShadow[mode],
  };
}
```

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: 커밋**

```bash
git add src/theme/useTheme.ts
git commit -m "OTT 토큰: useTheme 훅 추가 (시스템 설정 추종, 다크 폴백)"
```

---

### Task 4: `index.ts` 교체 + 호환 레이어

**Files:**
- Modify: `src/theme/index.ts` (전체 내용 교체 — 기존 필사본 테마 삭제)

**Interfaces:**
- Consumes: Task 1의 `typeScale` 등 토큰 전부, Task 2의 팔레트·함수, Task 3의 `useTheme`
- Produces: `@/theme` 공개 API. 새 코드용 — `useTheme`, `spacing`, `radius`, `typeScale`, `motion`, `layout`, `hairline`, `statusLabel`, `darkColors`, `lightColors`, `cardShadow`, `getLagStyle`, `getPaceStyle`, `ColorTokens`, `ThemeMode`. 레거시 화면용(`@deprecated`) — `colors`, `type`, `fonts`, `elevation`, `ornament`, `lagStyle`, `paceStyle`.

- [ ] **Step 1: 먼저 호환 레이어 없이 교체 (실패를 확인하기 위해)**

`src/theme/index.ts` 전체를 다음으로 교체:

```ts
/**
 * bookey 디자인 토큰 — OTT 테마 공개 API.
 * 새 코드: 색은 useTheme() 으로 받고, 모드 무관 토큰은 정적 import 한다.
 * 설계 문서: docs/superpowers/specs/2026-08-31-design-tokens-design.md
 */
export { spacing, radius, typeScale, motion, layout, hairline, statusLabel } from './tokens';
export { darkColors, lightColors, cardShadow, getLagStyle, getPaceStyle } from './palette';
export type { ColorTokens, ThemeMode } from './palette';
export { useTheme } from './useTheme';
```

- [ ] **Step 2: 타입 검사 — 실패해야 정상**

Run: `npm run typecheck`
Expected: **FAIL.** 기존 화면들이 쓰는 레거시 export가 사라졌기 때문. 오류 목록에 최소한 다음이 보여야 한다 — `colors`, `type`, `fonts`, `elevation`, `ornament`, `lagStyle`, `paceStyle` 를 찾을 수 없다는 오류(모듈 export 부재), 다수 파일. 이 목록이 곧 호환 레이어가 커버해야 할 전부다.

- [ ] **Step 3: 호환 레이어 추가**

`src/theme/index.ts` 하단에 이어서 추가:

```ts
// ── 임시 호환 레이어 ──────────────────────────────────────
// 기존 화면(필사본 테마 기준)이 다크 값으로 일단 동작하게 한다.
// 화면을 OTT 디자인으로 리디자인할 때 화면 단위로 아래 참조를 제거하고,
// 전부 끝나면 이 블록을 삭제한다.
import { darkColors as legacyDark, getLagStyle as legacyLag, getPaceStyle as legacyPace } from './palette';
import { typeScale as legacyType } from './tokens';

/** @deprecated useTheme().colors 를 사용하세요. */
export const colors = {
  ...legacyDark,
  ink: legacyDark.text,
  surfaceAlt: legacyDark.surfaceRaised,
  trackEmpty: legacyDark.line,
} as const;

/** @deprecated typeScale 을 사용하세요. */
export const type = {
  ...legacyType,
  subtitle: legacyType.section,
  eyebrow: legacyType.overline,
} as const;

/** @deprecated 시스템 폰트를 씁니다 — fontFamily 를 지정하지 마세요. */
export const fonts = { serif: undefined, mono: undefined } as { serif?: string; mono?: string };

/** @deprecated 다크는 그림자를 쓰지 않습니다. useTheme().cardShadow 를 사용하세요. */
export const elevation = { card: {} } as const;

/** @deprecated 장식 기호는 OTT 리디자인에서 제거됩니다. */
export const ornament = { section: '❧', divider: '⁘', bullet: '·' } as const;

/** @deprecated getLagStyle(useTheme().colors) 를 사용하세요. */
export const lagStyle = legacyLag(legacyDark);

/** @deprecated getPaceStyle(useTheme().colors) 를 사용하세요. */
export const paceStyle = legacyPace(legacyDark);
```

- [ ] **Step 4: 타입 검사 — 통과해야 한다**

Run: `npm run typecheck`
Expected: exit 0. 13개 화면 + `src/components/ui.tsx` + `src/components/BookCover.tsx` 전부 새 토큰 위에서 컴파일된다.

- [ ] **Step 5: 커밋**

```bash
git add src/theme/index.ts
git commit -m "필사본 테마를 OTT 토큰으로 교체, 레거시 호환 레이어 추가"
```

---

### Task 5: 루트 레이아웃 모드 추종 (`app/_layout.tsx`)

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: Task 4의 `useTheme`
- Produces: 없음 (최종 소비자). `StatusBar`와 `Stack` 색이 모드를 따라간다.

- [ ] **Step 1: `_layout.tsx`에서 정적 `colors` import를 `useTheme()`으로 교체**

변경 전 import:

```tsx
import { colors } from '@/theme';
```

변경 후:

```tsx
import { useTheme } from '@/theme';
```

`RootLayout` 본문 — 훅 호출을 추가하고, `StatusBar`의 `"dark"` 고정을 모드 추종으로 바꾼다:

```tsx
export default function RootLayout() {
  const restore = useAuth((s) => s.restore);
  const status = useAuth((s) => s.status);
  const [ready, setReady] = useState(false);
  const { mode, colors } = useTheme();

  useEffect(() => {
    restore().finally(() => setReady(true));
  }, [restore]);

  if (!ready || status === 'loading') {
    return <Loading />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          {/* Stack.Screen 목록은 기존 그대로 유지 */}
```

`Stack.Screen` 목록과 나머지 코드는 변경하지 않는다. (`app.json`의 `userInterfaceStyle: "automatic"`은 이미 설정돼 있으므로 손대지 않는다.)

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: 육안 검증 (웹)**

Run: `npm run web` (백엔드 없이도 로그인 화면까지는 뜬다)
확인:
1. 브라우저가 다크 선호(또는 무설정)일 때 앱 배경이 `#141414` 차콜로 뜬다.
2. DevTools → Rendering → `prefers-color-scheme: light` 에뮬레이션 시 배경이 `#FAFAFA`로 바뀌고 상태바 아이콘 색이 반전된다.
3. 탭 화면 진입 시(로그인 후 또는 라우트 직접 이동) 기존 화면들이 "레이아웃 그대로, 색만 다크"로 렌더링된다 — 스펙에 명시된 의도된 과도기 상태.

- [ ] **Step 4: 커밋**

```bash
git add app/_layout.tsx
git commit -m "루트 레이아웃이 다크/라이트 모드를 따라가도록 변경"
```
