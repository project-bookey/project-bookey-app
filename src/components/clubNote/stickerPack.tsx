import type { ReactNode } from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import type { ColorTokens } from '@/theme';
import { iconStroke } from '@/theme/tokens';

/**
 * 내장 그림 스티커 팩 — 콜라주 책상의 소품들. 종이를 오린 느낌으로 각진 획(iconStroke)에 테마 면색을 채운다.
 * 면은 다크에서도 밝게 남는 종이색(memoPad)이나 반투명 악센트를 쓴다 — *Soft 계열은 다크에서 어두운 덩어리로 보인다.
 * 색은 렌더 시점 테마에서 푸는 함수라 같은 문서가 다크·라이트에서 각각 어울리게 보인다.
 * Path·Rect·Circle·Line 만 쓴다 — Pattern·Defs·ClipPath 는 웹 번들을 깬다.
 */
export type PackSticker = { key: string; label: string; render: (size: number, colors: ColorTokens) => ReactNode };

/** 100×100 뷰박스 기준 획 굵기 — 60px 스티커에서 약 1.8px. */
const STROKE = 3;

const frame = (size: number, children: ReactNode) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    {children}
  </Svg>
);

const line = (colors: ColorTokens) => ({ ...iconStroke, strokeWidth: STROKE, stroke: colors.text });

export const STICKER_PACK: readonly PackSticker[] = [
  {
    key: 'book',
    label: '책',
    render: (size, c) =>
      frame(size, (
        <>
          <Rect x={22} y={14} width={56} height={72} fill={c.bookBoard} {...line(c)} />
          <Rect x={30} y={14} width={48} height={72} fill={c.bookPage} {...line(c)} />
          <Line x1={40} y1={34} x2={68} y2={34} {...line(c)} />
          <Line x1={40} y1={46} x2={68} y2={46} {...line(c)} />
          <Line x1={40} y1={58} x2={60} y2={58} {...line(c)} />
        </>
      )),
  },
  {
    key: 'coffee',
    label: '커피',
    render: (size, c) =>
      frame(size, (
        <>
          <Path d="M22 40H66V66C66 76 58 84 48 84H40C30 84 22 76 22 66Z" fill={c.memoPad} {...line(c)} />
          <Path d="M66 48H74C80 48 84 52 84 58C84 64 80 68 74 68H66" fill="none" {...line(c)} />
          <Line x1={18} y1={90} x2={72} y2={90} {...line(c)} />
          <Path d="M36 30C36 24 40 24 40 18M50 30C50 24 54 24 54 18" fill="none" {...line(c)} />
        </>
      )),
  },
  {
    key: 'bookmark',
    label: '책갈피',
    render: (size, c) =>
      frame(size, (
        <>
          <Path d="M30 10H70V90L50 74L30 90Z" fill={c.note} {...line(c)} />
          <Line x1={40} y1={26} x2={60} y2={26} {...line(c)} stroke={c.onNote} />
        </>
      )),
  },
  {
    key: 'tape',
    label: '마스킹테이프',
    render: (size, c) =>
      frame(size, (
        <Path
          d="M10 38L16 32L12 26L18 22H82L88 28L84 34L90 40L86 46L90 52L84 58L88 64L82 70H18L12 64L16 58L10 52L14 46Z"
          fill={c.memoPad}
          {...line(c)}
          strokeWidth={2}
        />
      )),
  },
  {
    key: 'clip',
    label: '클립',
    render: (size, c) =>
      frame(size, (
        <Path
          d="M34 78V26C34 18 40 14 46 14C52 14 58 18 58 26V70C58 74 55 77 51 77C47 77 44 74 44 70V30"
          fill="none"
          {...line(c)}
        />
      )),
  },
  {
    key: 'heart',
    label: '하트',
    render: (size, c) =>
      frame(size, (
        <Path
          d="M50 86L18 54C8 44 10 26 24 20C34 16 44 20 50 30C56 20 66 16 76 20C90 26 92 44 82 54Z"
          fill={c.danger}
          fillOpacity={0.55}
          {...line(c)}
        />
      )),
  },
  {
    key: 'star',
    label: '별',
    render: (size, c) =>
      frame(size, (
        <Path d="M50 10L61 38L90 40L67 58L75 88L50 72L25 88L33 58L10 40L39 38Z" fill={c.warn} fillOpacity={0.6} {...line(c)} />
      )),
  },
  {
    key: 'cloud',
    label: '구름',
    render: (size, c) =>
      frame(size, (
        <Path
          d="M28 74H74C84 74 90 66 90 58C90 50 84 44 76 44C74 32 64 24 52 24C40 24 30 32 28 44C18 44 10 50 10 60C10 68 18 74 28 74Z"
          fill={c.memoPad}
          {...line(c)}
        />
      )),
  },
  {
    key: 'arrow',
    label: '화살표',
    render: (size, c) =>
      frame(size, (
        <>
          <Path d="M14 72C30 40 56 30 84 34" fill="none" {...line(c)} />
          <Path d="M72 22L86 34L72 46" fill="none" {...line(c)} />
        </>
      )),
  },
  {
    key: 'wave',
    label: '물결 밑줄',
    render: (size, c) =>
      frame(size, (
        <Path
          d="M6 52C14 42 22 42 30 52C38 62 46 62 54 52C62 42 70 42 78 52C86 62 90 60 94 54"
          fill="none"
          {...line(c)}
          stroke={c.accent}
          strokeWidth={5}
        />
      )),
  },
  {
    key: 'pin',
    label: '압정',
    render: (size, c) =>
      frame(size, (
        <>
          <Line x1={50} y1={58} x2={50} y2={90} {...line(c)} />
          <Path d="M36 58H64L58 44V26H42V44Z" fill={c.memoPad} {...line(c)} />
          <Circle cx={50} cy={20} r={10} fill={c.danger} {...line(c)} />
        </>
      )),
  },
  {
    key: 'stamp',
    label: '우표',
    render: (size, c) =>
      frame(size, (
        <>
          <Rect x={14} y={14} width={72} height={72} fill={c.memoPad} {...line(c)} strokeDasharray="6 4" />
          <Rect x={26} y={26} width={48} height={48} fill={c.accentSoft} {...line(c)} strokeWidth={2} />
          <Path d="M34 66L46 50L54 60L60 54L66 66Z" fill={c.accent} stroke="none" />
        </>
      )),
  },
];

export const findPackSticker = (key: string) => STICKER_PACK.find((s) => s.key === key);

/** 이모지 스티커 — 사용자가 고르는 콘텐츠라 이모지가 허용된다(크롬 이모지 금지 규칙과 별개). */
export const EMOJI_STICKERS: readonly string[] = [
  '📚', '📖', '✨', '☕', '🍰', '🔥', '💯', '🌿', '❤️', '⭐', '🎉', '📝',
  '🍵', '🥐', '🌙', '☀️', '🍂', '🎧', '💡', '🔖', '🧸', '🍀', '🕯️', '📌',
];
