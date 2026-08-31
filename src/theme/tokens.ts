/**
 * bookey 디자인 토큰 — 모드(다크/라이트) 무관 값.
 *
 * 방향: 넷플릭스·디즈니+ 계열의 콘텐츠 플랫폼. Pretendard 에 크기·웨이트로
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
