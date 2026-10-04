/**
 * bookey 디자인 토큰 — 모드(다크/라이트) 무관 값.
 *
 * 방향: "콜라주 책상" — 어두운 책상 위에 책·메모·스티키 노트가 흩어진 감각.
 * 본문·라벨·숫자는 IBM Plex Sans KR, 표제·인용은 세리프(마루 부리)로 위계를 준다.
 * 형태는 오려 낸 종이처럼 네모.
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
 * 형태 언어 — 종이를 가위로 오린 네모. 칩·버튼·태그·카드 모두 각을 살리고(sm/md/lg),
 * 원이어야만 하는 것(아바타·점·라디오)만 round 를 쓴다. pill(999)은 쓰지 않는다.
 */
export const radius = {
  none: 0,
  sm: 2, // 책 표지·칩·버튼·태그·입력
  md: 4, // 카드
  lg: 6, // 시트·모달
  round: 999, // 아바타·점·라디오 — 원이어야만 하는 것
} as const;

/**
 * 브랜드 서체 — IBM Plex Sans KR (assets/fonts, 앱 시작 시 expo-font 로 로드).
 * 2026-10-04 Pretendard 에서 교체 — 요즘 앱·AI 생성 화면에서 너무 흔해서. 숫자 폭이 모두 같아(tabular)
 * 타이머처럼 매초 바뀌는 숫자도 흔들리지 않는다.
 * 웨이트별 파일을 별도 패밀리로 등록하므로, 스타일에는 fontFamily 만 쓰고
 * fontWeight 를 함께 지정하지 않는다 (iOS 가 다른 웨이트를 찾다 시스템 폰트로
 * 떨어지는 것을 막기 위함).
 */
export const sans = {
  regular: 'IBMPlexSansKR-Regular', // 400
  semiBold: 'IBMPlexSansKR-SemiBold', // 600
  bold: 'IBMPlexSansKR-Bold', // 700
  extraBold: 'IBMPlexSansKR-Bold', // 이 서체는 700 이 가장 굵다 — 위계는 크기로 준다
} as const;

/**
 * 세리프(마루 부리) — 표제·섹션 헤딩·인용문 전용. 2026-10-04 나눔명조에서 교체.
 * Google Fonts 에 없어 파일(assets/fonts)로 넣는다. 키 이름은 쓰임새(본문/표제/히어로)를 따르고
 * 실제 굵기는 한 단계씩 가볍다 — 서체 시안(2026-10-04)에서 고른 짝 그대로.
 */
export const serif = {
  regular: 'MaruBuri-Regular', // 400
  bold: 'MaruBuri-SemiBold', // 600
  extraBold: 'MaruBuri-Bold', // 700
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

/** 노트 텍스트에서 사용자가 고르는 '모노' 글꼴 — 앱 화면(라벨·숫자)에는 쓰지 않는다. */
export const noteMono = 'IBMPlexMono_400Regular';

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
 * 선 아이콘 공통 획 — 끝(cap)과 모서리(join)를 각지게. 둥근 캡은 범용 아이콘 세트
 * 느낌이 나서 쓰지 않는다. react-native-svg 의 Path/Circle 에 그대로 펼친다.
 */
export const iconStroke = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' } as const;

export const statusLabel: Record<string, string> = {
  WANT_TO_READ: '읽고 싶은',
  READING: '읽는 중',
  PAUSED: '멈춤',
  FINISHED: '완독',
  ABANDONED: '하차',
};
