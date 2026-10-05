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
  /** 종이 카드에서 사진이 없을 때 쓰는 보조 바탕 */
  paperAlt: string;
  /** 시트·모달·눌림 — 다크에서는 밝기가 곧 높이다 */
  surfaceRaised: string;
  text: string;
  textMuted: string;
  textFaint: string;
  /** 헤어라인·트랙 */
  line: string;
  /** 굵은 구분선·시트 테두리·장식 획 — 누를 수 있는 것의 테두리는 control 을 쓴다 */
  lineStrong: string;
  /**
   * 누를 수 있는 것의 테두리(아웃라인 버튼·칩·토글·카드 발치 버튼). 배경·카드·시트 어디서든 대비 3:1 이상
   * (WCAG 1.4.11) — lineStrong(1.5:1)으로는 버튼이 상자 없는 글자처럼 보였다(2026-10-04).
   */
  control: string;
  /** CTA·진행 바·링크·긍정 상태 — 민트 하나로 통일(2026-09-28 세이지·주홍·형광펜 대조 후 유지 결정) */
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
  /** 앱 둘러보기 딤 — 비춘 구멍만 또렷하게 남도록 모달 딤보다 짙다. */
  scrimFocus: string;
  /** 반투명 유리 말풍선 면 — 앱 둘러보기 설명. 둘러보기는 다크로 고정해 그리므로 다크 값이 실제로 쓰인다. */
  bubble: string;
  /** 유리 말풍선 테두리 */
  bubbleEdge: string;
  /** 포스터 하단→투명 그라데이션 색 스톱. 렌더링은 화면 작업 때 expo-linear-gradient 로. */
  scrimStops: readonly [string, string];
  /** 배경 보조 톤 — 섹션 구분·서브 배경 */
  bgAlt: string;
  /** surface 보다 더 깊은 면 — 콜라주 책상 바닥 */
  surfaceDeep: string;
  /** 화면 배경 위 도트 그리드 질감 색 */
  dotGrid: string;
  /** 스티키 노트 배경 (accent 와 동일 값) */
  note: string;
  /** 스티키 노트 위 텍스트 (onAccent 와 동일 값) */
  onNote: string;
  /** 중간 톤 회색 — textMuted/textFaint 사이 보조 텍스트 */
  mid: string;
  /** 장정된 책 판(board) — 다크는 어두운 천, 라이트는 리넨 */
  bookBoard: string;
  /** 책장 단면(페이지 블록)의 종이색 */
  bookPage: string;
  /** 띠지 — 판과 반전되는 종이(다크)/먹지(라이트) */
  bookBand: string;
  /** 띠지 위 텍스트 */
  onBookBand: string;
  /** 책 뒤에 끼워 둔 메모장 종이 */
  memoPad: string;
  /** 메모장 위 잉크 */
  onMemoPad: string;
  /** 선택 상태(칩·세그먼트·달력 날짜·반응·라디오) — 도장처럼 잉크로 반전. 악센트는 CTA·진행·링크에만 쓴다. */
  ink: string;
  /** 잉크 위 텍스트 */
  onInk: string;
  /** 노트 펜 파랑 — 팔레트에 파랑이 없어 노트 잉크 전용으로 둔다. 다크는 하늘, 라이트는 짙은 파랑. */
  penBlue: string;
  /**
   * 회색 톤 바탕 — 보조 버튼·칩·카드 발치 버튼의 면(2026-10-05 '부드러운 네모'). 테두리 없이 면으로 '누를 수 있음'을
   * 보이므로 surfaceRaised 보다 한 단계 진하다. 버튼에서는 glassFace 가 glassAlpha 로 비치게 깐다.
   */
  tonal: string;
  /** 세그먼트의 고른 칸 — 트랙 위에 떠 있는 종이(라이트는 흰 종이, 다크는 한 단계 밝은 면). */
  thumb: string;
  /** 떠 있는 유리 면(머리 아이콘 원·트랙) — 블러가 없는 기기에서도 반투명으로 비친다. */
  glass: string;
  /** 유리 버튼의 가장자리 — 빛이 맺힌 얇은 선. */
  glassEdge: string;
  /** 유리 버튼 윗선의 하이라이트(안쪽 1px). */
  glassHighlight: string;
  /**
   * 반투명 악센트 버튼 위 글자 — 악센트를 glassAlpha 로 비치게 깔면 라이트에서는 흰 글자 대비가 2.4:1 로 떨어져
   * 잉크(짙은 글자)로 바꾼다. 다크는 onAccent 와 같다.
   */
  onAccentGlass: string;
};

export type ThemeMode = 'dark' | 'light';

export const darkColors: ColorTokens = {
  bg: '#0c0e0d',
  surface: '#171a16',
  paperAlt: '#20251f',
  surfaceRaised: '#1d211c',
  text: '#e8e6e1',
  textMuted: '#9a9790',
  textFaint: '#6f6d66',
  line: '#23261f',
  lineStrong: '#33372e',
  control: '#77746c',
  accent: '#3ddc97',
  onAccent: '#0c0e0d',
  accentSoft: '#16352a',
  warn: '#F0B429',
  warnSoft: '#38290F',
  danger: '#FF6B60',
  dangerSoft: '#3A1714',
  scrimDim: 'rgba(0,0,0,0.55)',
  scrimFocus: 'rgba(0,0,0,0.72)',
  bubble: 'rgba(22,24,21,0.72)',
  bubbleEdge: 'rgba(255,255,255,0.22)',
  scrimStops: ['transparent', 'rgba(0,0,0,0.85)'],
  bgAlt: '#131413',
  surfaceDeep: '#141712',
  dotGrid: '#1b1e1a',
  note: '#3ddc97',
  onNote: '#0c0e0d',
  mid: '#8c8981',
  bookBoard: '#1e221d',
  bookPage: '#e1dccf',
  bookBand: '#e8e6e1',
  onBookBand: '#0c0e0d',
  memoPad: '#e9e4d6',
  onMemoPad: '#2a2c27',
  ink: '#e8e6e1',
  onInk: '#0c0e0d',
  penBlue: '#6fb1ff',
  tonal: '#2a2f28',
  thumb: '#3a4037',
  glass: 'rgba(40,44,38,0.42)',
  glassEdge: 'rgba(255,255,255,0.22)',
  glassHighlight: 'rgba(255,255,255,0.28)',
  onAccentGlass: '#0c0e0d',
};

export const lightColors: ColorTokens = {
  bg: '#faf8f4',
  surface: '#ffffff',
  paperAlt: '#f0eadf',
  surfaceRaised: '#efece4',
  text: '#1a1c18',
  textMuted: '#57554f',
  textFaint: '#8b887f',
  line: '#e5e1d7',
  lineStrong: '#cfcabc',
  control: '#858277',
  accent: '#177a54',
  onAccent: '#ffffff',
  accentSoft: '#ddf2e7',
  warn: '#8A5A12',
  warnSoft: '#FDF0D5',
  danger: '#B3362B',
  dangerSoft: '#FBE4E1',
  scrimDim: 'rgba(0,0,0,0.45)',
  scrimFocus: 'rgba(0,0,0,0.72)',
  bubble: 'rgba(250,248,244,0.78)',
  bubbleEdge: 'rgba(255,255,255,0.7)',
  scrimStops: ['transparent', 'rgba(0,0,0,0.85)'],
  bgAlt: '#f4f1ea',
  surfaceDeep: '#f1eee6',
  dotGrid: '#e7e3d9',
  note: '#177a54',
  onNote: '#ffffff',
  mid: '#6e6b63',
  bookBoard: '#d9d2c2',
  bookPage: '#e1dccf',
  bookBand: '#171a16',
  onBookBand: '#e8e6e1',
  memoPad: '#fbf9f2',
  onMemoPad: '#3b3d38',
  ink: '#1a1c18',
  onInk: '#faf8f4',
  penBlue: '#1f5fbf',
  tonal: '#ebe7dc',
  thumb: '#ffffff',
  glass: 'rgba(255,255,255,0.5)',
  glassEdge: 'rgba(255,255,255,0.85)',
  glassHighlight: 'rgba(255,255,255,0.95)',
  onAccentGlass: '#1a1c18',
};

/**
 * 엘리베이션 없음 — 종이는 헤어라인 테두리로만 구분한다. 블러 그림자(AI 느낌)도, 밑에 깔린 종이의
 * 단(하드 오프셋 — "뒤에 종이가 하나 더 나온다"는 피드백)도 쓰지 않는다. 두 토큰은 소비처(Card·StickyNote·
 * TiltCover 등)의 계약을 지키려고 빈 스타일로 남긴다 — 다시 무언가를 깔고 싶으면 여기 한 곳만 바꾼다.
 */
export const cardShadow: Record<ThemeMode, ViewStyle> = { dark: {}, light: {} };
export const coverShadow: Record<ThemeMode, { rest: ViewStyle; lifted: ViewStyle }> = {
  dark: { rest: {}, lifted: {} },
  light: { rest: {}, lifted: {} },
};

/** 지연 단계(§F4) → 색. 팔레트를 따라가도록 함수로 제공한다. */
export function getLagStyle(colors: ColorTokens): Record<string, { label: string; fg: string; bg: string }> {
  return {
    L0_NORMAL: { label: '순조로움', fg: colors.textMuted, bg: colors.surfaceRaised },
    L1_CAUTION: { label: '조금 늦음', fg: colors.warn, bg: colors.warnSoft },
    L2_DELAYED: { label: '늦음', fg: colors.warn, bg: colors.warnSoft },
    L3_SERIOUS: { label: '많이 늦음', fg: colors.danger, bg: colors.dangerSoft },
    L4_NEGLECTED: { label: '오래 쉼', fg: colors.danger, bg: colors.dangerSoft },
  };
}

/** 페이스 → 색. 긍정 상태는 악센트가 겸한다. */
export function getPaceStyle(colors: ColorTokens): Record<string, { label: string; fg: string; bg: string }> {
  return {
    ON_TRACK: { label: '순조로움', fg: colors.accent, bg: colors.accentSoft },
    BEHIND: { label: '조금 늦음', fg: colors.warn, bg: colors.warnSoft },
    AT_RISK: { label: '많이 늦음', fg: colors.danger, bg: colors.dangerSoft },
  };
}
