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
  accent: '#3ddc97',
  onAccent: '#0c0e0d',
  accentSoft: '#16352a',
  warn: '#F0B429',
  warnSoft: '#38290F',
  danger: '#FF6B60',
  dangerSoft: '#3A1714',
  scrimDim: 'rgba(0,0,0,0.55)',
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
  accent: '#177a54',
  onAccent: '#ffffff',
  accentSoft: '#ddf2e7',
  warn: '#8A5A12',
  warnSoft: '#FDF0D5',
  danger: '#B3362B',
  dangerSoft: '#FBE4E1',
  scrimDim: 'rgba(0,0,0,0.45)',
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
};

/** 브랜드 틸 그라데이션 — 무표지 도서 배경·로그인 배경 등 브랜드 표면 공용. 새 민트 기준 재조정. */
export const brandGradientStops = ['#123528', '#16352a', '#0a1712'] as const;

/**
 * 종이 겹침 — 블러 그림자 대신 밑에 깔린 종이의 단(하드 오프셋). 새 아키텍처의 `boxShadow` 라
 * iOS·Android·웹이 같은 꼴로 그리고, 검정은 다크 바탕에서 안 보여 lineStrong 색으로 민다.
 * 카드·스티키 노트·CTA 는 3px, 표지는 2px, 눌러 들리면 5px. `shadow*`/`elevation` 은 쓰지 않는다.
 */
const EDGE = { dark: '#33372e', light: '#cfcabc' } as const;
const paperEdge = (px: number, mode: ThemeMode): ViewStyle => ({ boxShadow: `${px}px ${px}px 0 ${EDGE[mode]}` });

/** 카드 단 — Card 프리미티브·스티키 노트·폴라로이드가 펼친다. useTheme() 이 mode 에 맞는 것을 내려준다. */
export const cardShadow: Record<ThemeMode, ViewStyle> = {
  dark: paperEdge(3, 'dark'),
  light: paperEdge(3, 'light'),
};

/** 표지 단 — 평상시(rest) 2px, 눌림 리프트(lifted) 5px. TiltCover 등 콜라주 표지 컴포넌트가 사용. */
export const coverShadow: Record<ThemeMode, { rest: ViewStyle; lifted: ViewStyle }> = {
  dark: { rest: paperEdge(2, 'dark'), lifted: paperEdge(5, 'dark') },
  light: { rest: paperEdge(2, 'light'), lifted: paperEdge(5, 'light') },
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
