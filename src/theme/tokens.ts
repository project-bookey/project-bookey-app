/**
 * bookey 디자인 토큰 — 모드(다크/라이트) 무관 값.
 *
 * 방향: "콜라주 책상" — 어두운 책상 위에 책·메모·스티키 노트가 흩어진 감각.
 * 세리프(나눔명조)로 표제·인용에 위계를 주고, 모노(IBM Plex Mono)로
 * 아이브로우·라벨·숫자를 짚는다. 형태는 칩·CTA는 pill, 카드는 근사각.
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

/** 형태 언어. 칩·CTA는 pill(999) — 카드는 근사각(md/lg), 책 표지만 sm 유지. */
export const radius = {
  none: 0,
  sm: 2, // 책 표지
  md: 6, // 카드·입력
  lg: 10, // 시트·모달
  pill: 999,
} as const;

/**
 * 브랜드 서체 — Pretendard (앱 시작 시 expo-font 로 로드).
 * 웨이트별 파일을 별도 패밀리로 등록하므로, 스타일에는 fontFamily 만 쓰고
 * fontWeight 를 함께 지정하지 않는다 (iOS 가 다른 웨이트를 찾다 시스템 폰트로
 * 떨어지는 것을 막기 위함).
 */
export const sans = {
  regular: 'Pretendard-Regular', // 400
  semiBold: 'Pretendard-SemiBold', // 600
  bold: 'Pretendard-Bold', // 700
  extraBold: 'Pretendard-ExtraBold', // 800
} as const;

/**
 * 세리프(나눔명조) — 표제·섹션 헤딩·인용문 전용.
 * expo-font 로 앱 시작 시 로드(app/_layout.tsx).
 */
export const serif = {
  regular: 'NanumMyeongjo_400Regular',
  bold: 'NanumMyeongjo_700Bold',
  extraBold: 'NanumMyeongjo_800ExtraBold',
} as const;

/**
 * 모노(IBM Plex Mono) — 아이브로우·라벨·숫자 전용.
 * 한글 글리프는 시스템 폴백(의도된 동작 — 시안 웹과 동일).
 */
export const mono = {
  regular: 'IBMPlexMono_400Regular',
  medium: 'IBMPlexMono_500Medium',
  semiBold: 'IBMPlexMono_600SemiBold',
} as const;

/** 타입 스케일. 위계는 크기 + Pretendard 웨이트로 만든다. */
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
  /** 아이브로우 — 주로 악센트 색으로 쓴다 */
  overline: { fontFamily: sans.bold, fontSize: 11, letterSpacing: 1.5 },
  /** 히어로 표제 — 세리프 */
  displaySerif: { fontFamily: serif.extraBold, fontSize: 30, lineHeight: 40, letterSpacing: -0.5 },
  /** 화면·섹션 표제 — 세리프 */
  titleSerif: { fontFamily: serif.bold, fontSize: 22, lineHeight: 30 },
  /** 인용문 */
  quote: { fontFamily: serif.regular, fontSize: 17, lineHeight: 28 },
  /** 라벨 — 모노 */
  monoLabel: { fontFamily: mono.medium, fontSize: 11, letterSpacing: 1.2 },
  /** 아이브로우 — 모노 */
  monoEyebrow: { fontFamily: mono.semiBold, fontSize: 10, letterSpacing: 2 },
  /** 숫자 — 모노 */
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

export const statusLabel: Record<string, string> = {
  WANT_TO_READ: '읽고 싶은',
  READING: '읽는 중',
  PAUSED: '멈춤',
  FINISHED: '완독',
  ABANDONED: '하차',
};
