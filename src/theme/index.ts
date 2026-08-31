/**
 * bookey 디자인 토큰 — OTT 테마 공개 API.
 * 새 코드: 색은 useTheme() 으로 받고, 모드 무관 토큰은 정적 import 한다.
 * 설계 문서: docs/superpowers/specs/2026-08-31-design-tokens-design.md
 */
export { spacing, radius, typeScale, motion, layout, hairline, statusLabel } from './tokens';
export { darkColors, lightColors, cardShadow, getLagStyle, getPaceStyle } from './palette';
export type { ColorTokens, ThemeMode } from './palette';
export { useTheme } from './useTheme';

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
