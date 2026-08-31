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
