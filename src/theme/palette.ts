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
  /** 헤더·탭바 크롬 — 모드 무관 블랙 고정 (브랜드 결정) */
  chrome: string;
  /** 크롬 위 텍스트·활성 탭 */
  onChrome: string;
  /** 크롬 위 비활성 탭 */
  onChromeFaint: string;
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
  chrome: '#000000',
  onChrome: '#F5F5F5',
  onChromeFaint: '#737373',
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
  chrome: '#000000',
  onChrome: '#F5F5F5',
  onChromeFaint: '#737373',
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
