/**
 * bookey 디자인 토큰 — 모드(다크/라이트) 무관 값.
 *
 * 방향: "콜라주 책상" — 어두운 책상 위에 책·메모·스티키 노트가 흩어진 감각.
 * 모든 텍스트는 고운바탕을 사용하고 크기와 굵기로 위계를 준다.
 * 형태는 오려 낸 종이처럼 네모 — 누르는 것만 모서리를 살짝 둥글린다.
 * 설계 문서: docs/superpowers/specs/2026-09-01-collage-redesign-design.md
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16, // 화면 좌우 여백
  xl: 24, // 섹션 사이
  xxl: 36,
} as const;

/**
 * 형태 언어 — 오려 낸 종이처럼 각진 네모. 카드·입력·시트·태그·책 표지는 각을 살리고(sm/md/lg),
 * 누르는 것(버튼·칩·세그먼트·토글)만 모서리를 살짝 둥글린다(button·control — 2026-10-05 사용자 결정,
 * 버튼 비교 페이지 16-C). 버튼만 바꾸려면 button·control 만 고친다 — 다른 것까지 번지지 않게 토큰을 나눴다.
 * 원이어야만 하는 것(아바타·점·라디오)만 round 를 쓴다. 버튼을 캡슐(999)로 만들지 않는다.
 */
export const radius = {
  none: 0,
  sm: 2, // 책 표지·태그·배지·입력·사진
  md: 4, // 카드·입력 칸
  lg: 6, // 시트·모달
  control: 3, // 작은 버튼(sm·xs)·칩·세그먼트 칸·토글·작은 누르는 칸
  button: 4, // 버튼(md)·세그먼트 틀
  round: 999, // 아바타·점·라디오 — 원이어야만 하는 것
} as const;

/**
 * 브랜드 서체 — 고운바탕 (assets/fonts, 앱 시작 시 expo-font 로 로드).
 * 웨이트별 파일을 별도 패밀리로 등록하므로, 스타일에는 fontFamily 만 쓰고
 * fontWeight 를 함께 지정하지 않는다 (iOS 가 다른 웨이트를 찾다 시스템 폰트로
 * 떨어지는 것을 막기 위함).
 */
export const sans = {
  regular: 'GowunBatang-Regular', // 400
  semiBold: 'GowunBatang-Bold', // 고운바탕은 400/700 두 굵기를 제공한다
  bold: 'GowunBatang-Bold', // 700
  extraBold: 'GowunBatang-Bold', // 가장 굵은 700을 사용하고 위계는 크기로 보완한다
} as const;

/**
 * 기존 스타일 API 호환을 위해 sans/serif 토큰 이름은 유지하되 모두 고운바탕을 가리킨다.
 */
export const serif = {
  regular: 'GowunBatang-Regular', // 400
  bold: 'GowunBatang-Bold', // 700
  extraBold: 'GowunBatang-Bold', // 700
} as const;

/**
 * 라벨·숫자 서체 — 아이브로우·라벨·숫자. 이름은 예전 모노(IBM Plex Mono)에서 왔지만
 * 2026-10-04 부터 본문 서체(IBM Plex Sans KR)를 한 단계 굵게 쓴다. 영문 대문자 모노 아이브로우가
 * 'AI 에디토리얼' 인상을 가장 많이 만들어서 뺐다. 쓰는 곳이 많아 이름은 그대로 둔다.
 */
export const mono = {
  regular: sans.regular,
  medium: sans.semiBold,
  semiBold: sans.bold,
} as const;

/** 노트의 기존 '모노' 옵션도 전역 서체 통일을 위해 고운바탕으로 표시한다. */
export const noteMono = 'GowunBatang-Regular';

/** 타입 스케일. 위계는 크기 + 웨이트로 만든다. */
export const typeScale = {
  /** 히어로 책 제목 */
  display: { fontFamily: sans.extraBold, fontSize: 28, letterSpacing: -0.5 },
  /** 화면 제목 */
  title: { fontFamily: sans.bold, fontSize: 22 },
  /** 행(캐러셀) 머리글 */
  section: { fontFamily: sans.bold, fontSize: 17 },
  body: { fontFamily: sans.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: sans.semiBold, fontSize: 15 },
  /** 버튼·탭·칩 */
  label: { fontFamily: sans.semiBold, fontSize: 13 },
  /** 메타 정보 */
  caption: { fontFamily: sans.regular, fontSize: 12 },
  /** 아이브로우 — 뮤트 톤으로 쓴다(악센트는 CTA·진행·링크 몫) */
  overline: { fontFamily: sans.bold, fontSize: 11, letterSpacing: 0.8 },
  /** 히어로 표제 — 세리프 */
  displaySerif: { fontFamily: serif.extraBold, fontSize: 30, lineHeight: 40, letterSpacing: -0.5 },
  /** 화면·섹션 표제 — 세리프 */
  titleSerif: { fontFamily: serif.bold, fontSize: 22, lineHeight: 30 },
  /** 인용문 */
  quote: { fontFamily: serif.regular, fontSize: 17, lineHeight: 28 },
  /** 라벨. 한글은 자간을 벌리면 글자가 흩어져 보여 좁게 둔다. */
  monoLabel: { fontFamily: mono.medium, fontSize: 11, letterSpacing: 0.2 },
  /** 아이브로우 */
  monoEyebrow: { fontFamily: mono.semiBold, fontSize: 10, letterSpacing: 0.4 },
  /** 숫자 */
  monoNumeral: { fontFamily: mono.semiBold, fontSize: 13 },
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

/** 콜라주 표지 기울기(도) — 인덱스 순환. */
export const tilt = [-4, -2, 3, -3, 5, -2, 6, 2] as const;

/** tilt 를 인덱스로 순환 조회한다(음수 인덱스도 안전). */
export function tiltFor(i: number): number {
  return tilt[((i % tilt.length) + tilt.length) % tilt.length];
}

/** 입장 스태거 — step: 항목당 지연(ms), max: 지연을 적용할 최대 개수. */
export const stagger = { step: 60, max: 8 } as const;

/** 가로 행(캐러셀) 지그재그 세로 오프셋(px) — 인덱스 순환. */
export const rowOffsetY = [0, 10, 4, 14, 6, 12] as const;

export const hairline = 1;

/** 눌림 피드백 — 글자·행·아이콘 버튼이 눌린 동안 펼치는 한 가지 값. 제각각이던 0.7~0.75 를 여기로 모은다. */
export const pressedStyle = { opacity: 0.72 } as const;

/**
 * 버튼 높이 — 2026-10-05 사용자 결정(버튼 비교 페이지). md 는 주요·보조 버튼, sm·xs 는 카드 발치·글 옆 버튼.
 * 겉모습이 44pt 보다 작으면 hitSlop 으로 터치 상자를 44pt 로 넓힌다(UX 철칙 Fitts).
 */
export const controlHeight = { md: 48, sm: 32, xs: 26 } as const;

/**
 * 선 아이콘 공통 획 — 끝(cap)과 모서리(join)를 각지게. 둥근 캡은 범용 아이콘 세트
 * 느낌이 나서 쓰지 않는다. react-native-svg 의 Path/Circle 에 그대로 펼친다.
 */
export const iconStroke = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' } as const;

/**
 * 글자 대신 쓰는 아이콘 크기(2026-10-05 사용자 결정 — 아이콘 고르기 페이지). meta 는 모노 메타·캡션 한 줄 안(사람·장소·시계 + 숫자),
 * inline 은 작은 버튼·칩·태그 안(연필·휴지통·복사 …). 상자 없는 아이콘 버튼은 ICON_SIZE(24, collage/IconButton)다.
 */
export const iconSize = { meta: 12, inline: 16 } as const;

export const statusLabel: Record<string, string> = {
  WANT_TO_READ: '읽고 싶음',
  READING: '읽는 중',
  PAUSED: '쉬는 중',
  FINISHED: '완독',
  ABANDONED: '하차',
};
