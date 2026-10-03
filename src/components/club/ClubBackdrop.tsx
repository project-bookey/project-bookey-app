import type { ReactElement } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, type LineProps } from 'react-native-svg';

import type { ColorTokens } from '@/theme';
import { useTheme } from '@/theme';

/** 기본 배경의 판 — 16:9 좌표에 그리고 slice 로 어느 띠에든 꽉 채운다. */
const W = 400;
const H = 225;

type Paint = { c: ColorTokens };

/** 그림 속 선은 모두 각진 끝(앱 아이콘 선과 같은 결). */
function Ln(props: LineProps) {
  return <Line strokeLinecap="square" strokeWidth={1} {...props} />;
}

/** 종이 위 글줄 — 길이를 조금씩 달리해 손으로 쓴 것처럼. 다크에서도 종이 쪽은 밝을 수 있어 중간 회색을 옅게 쓴다. */
function TextLines({ x, y, w, n, gap, seed, c }: Paint & {
  x: number; y: number; w: number; n: number; gap: number; seed: number;
}) {
  const cut = Math.floor(w / 3);
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <Ln
          key={i}
          x1={x}
          y1={y + i * gap}
          x2={x + w - ((i * 37 + seed * 13) % cut)}
          y2={y + i * gap}
          stroke={c.mid}
          strokeWidth={2}
          opacity={0.35}
        />
      ))}
    </>
  );
}

/** 형광펜 한 줄 — 초록을 옅게. */
function Marker({ x, y, w, h, c }: Paint & { x: number; y: number; w: number; h: number }) {
  return <Rect x={x} y={y} width={w} height={h} fill={c.accent} opacity={0.2} />;
}

/** 초록 스티키 한 장 — 모든 장면에 붙는 bookey 의 표시(앱의 메모 · 조각). */
function Sticky({ x, y, size, tilt, c }: Paint & { x: number; y: number; size: number; tilt: number }) {
  return (
    <G transform={`rotate(${tilt} ${x + size / 2} ${y + size / 2})`}>
      <Rect x={x} y={y} width={size} height={size} fill={c.note} />
      <Ln x1={x + 8} y1={y + size * 0.38} x2={x + size - 10} y2={y + size * 0.38} stroke={c.onNote} strokeWidth={2} opacity={0.55} />
      <Ln x1={x + 8} y1={y + size * 0.58} x2={x + size - 18} y2={y + size * 0.58} stroke={c.onNote} strokeWidth={2} opacity={0.55} />
    </G>
  );
}

/** A · 모임 테이블 — 위에서 내려다본 테이블: 펼친 책 · 덮어 둔 책 · 찻잔 둘 · 연필. */
function TableScene({ c }: Paint) {
  return (
    <>
      {/* 나뭇결 */}
      {[14, 42, 70, 98, 126, 154, 182, 210].map((y) => (
        <Ln key={y} x1={0} y1={y} x2={W} y2={y} stroke={c.lineStrong} opacity={0.35} />
      ))}
      {/* 펼친 책 */}
      <G transform="translate(40 18) rotate(-7 110 71)">
        <Rect x={-6} y={-4} width={232} height={150} fill={c.lineStrong} />
        <Rect x={0} y={0} width={110} height={142} fill={c.memoPad} stroke={c.line} strokeWidth={1} />
        <Rect x={110} y={0} width={110} height={142} fill={c.memoPad} stroke={c.line} strokeWidth={1} />
        <Ln x1={110} y1={0} x2={110} y2={142} stroke={c.lineStrong} strokeWidth={2} />
        <TextLines x={12} y={22} w={86} n={7} gap={14} seed={1} c={c} />
        <TextLines x={122} y={22} w={86} n={7} gap={14} seed={3} c={c} />
        <Marker x={122} y={46} w={60} h={9} c={c} />
      </G>
      {/* 덮어 둔 책 */}
      <G transform="translate(286 8) rotate(14 46 64)">
        <Rect x={0} y={0} width={92} height={128} fill={c.paperAlt} stroke={c.lineStrong} strokeWidth={1} />
        <Rect x={0} y={0} width={10} height={128} fill={c.lineStrong} />
        <Ln x1={22} y1={30} x2={76} y2={30} stroke={c.lineStrong} strokeWidth={2} />
        <Ln x1={22} y1={40} x2={62} y2={40} stroke={c.lineStrong} strokeWidth={2} />
        <Rect x={22} y={96} width={40} height={6} fill={c.accent} opacity={0.35} />
      </G>
      {/* 찻잔 둘 */}
      {[[40, 40], [370, 150]].map(([cx, cy]) => (
        <G key={cx}>
          <Circle cx={cx} cy={cy} r={26} fill={c.surfaceRaised} stroke={c.line} strokeWidth={1} />
          <Circle cx={cx} cy={cy} r={17} fill={c.memoPad} stroke={c.lineStrong} strokeWidth={1} />
          <Circle cx={cx} cy={cy} r={12} fill={c.mid} opacity={0.55} />
          <Rect x={cx + 15} y={cy - 4} width={12} height={8} rx={3} fill={c.memoPad} stroke={c.lineStrong} strokeWidth={1} />
        </G>
      ))}
      {/* 연필 */}
      <G transform="translate(250 150) rotate(-22 60 4)">
        <Rect x={0} y={0} width={120} height={9} fill={c.warnSoft} stroke={c.lineStrong} strokeWidth={1} />
        <Path d="M0 0 L-14 4.5 L0 9 Z" fill={c.bookPage} />
        <Path d="M-9 3 L-14 4.5 L-9 6 Z" fill={c.ink} />
        <Rect x={120} y={0} width={10} height={9} fill={c.lineStrong} />
      </G>
      <Sticky x={232} y={26} size={40} tilt={6} c={c} />
    </>
  );
}

/** 책장 한 칸의 책 — 너비 · 높이 · 색을 표에서 돌려 뽑아 늘 같은 책장이 나온다. */
const SPINE_W = [20, 16, 26, 18, 22, 14, 28, 18, 20, 24, 16, 22, 19];
const SPINE_H = [78, 66, 86, 72, 80, 62, 90, 70, 76, 84, 68, 74, 80];
const SPINE_TONES: readonly (keyof ColorTokens)[] = [
  'memoPad', 'bookBoard', 'paperAlt', 'lineStrong', 'accentSoft',
  'bookPage', 'memoPad', 'bookBoard', 'accentSoft', 'paperAlt',
];

function shelfRow(floor: number, seed: number, until: number) {
  const books: { x: number; y: number; w: number; h: number; tone: keyof ColorTokens }[] = [];
  let x = 16;
  for (let i = 0; x < until; i++) {
    const w = SPINE_W[(i + seed) % SPINE_W.length];
    const h = SPINE_H[(i * 3 + seed) % SPINE_H.length];
    books.push({ x, y: floor - h, w, h, tone: SPINE_TONES[(i + seed) % SPINE_TONES.length] });
    x += w + 2;
  }
  return { books, end: x };
}

const SHELF_TOP = shelfRow(98, 0, 262);
const SHELF_BOTTOM = shelfRow(196, 5, 380);

function Spines({ books, c }: Paint & { books: typeof SHELF_TOP.books }) {
  return (
    <>
      {books.map((b) => (
        <G key={b.x}>
          <Rect x={b.x} y={b.y} width={b.w} height={b.h} fill={c[b.tone] as string} stroke={c.lineStrong} strokeWidth={1} />
          <Ln x1={b.x + 4} y1={b.y + 12} x2={b.x + b.w - 4} y2={b.y + 12} stroke={c.mid} opacity={0.4} />
          <Ln x1={b.x + 4} y1={b.y + 16} x2={b.x + b.w - 4} y2={b.y + 16} stroke={c.mid} opacity={0.4} />
        </G>
      ))}
    </>
  );
}

/** C · 책장 — 두 칸 책장, 기대 놓은 책 한 권과 화분. */
function ShelfScene({ c }: Paint) {
  const lean = SHELF_TOP.end;
  return (
    <>
      <Spines books={SHELF_TOP.books} c={c} />
      <Rect
        x={lean + 4}
        y={30}
        width={22}
        height={68}
        fill={c.paperAlt}
        stroke={c.lineStrong}
        strokeWidth={1}
        transform={`rotate(16 ${lean + 15} 98)`}
      />
      {/* 화분 */}
      <Rect x={344} y={74} width={30} height={24} fill={c.bookPage} stroke={c.lineStrong} strokeWidth={1} />
      <Path d="M359 74 C350 54 336 50 330 40 C346 42 356 54 359 74 Z" fill={c.accent} opacity={0.75} />
      <Path d="M359 74 C364 50 378 44 386 36 C384 54 372 64 359 74 Z" fill={c.accentSoft} />
      {/* 선반 */}
      <Rect x={0} y={98} width={W} height={8} fill={c.lineStrong} />
      <Ln x1={0} y1={106} x2={W} y2={106} stroke={c.bookBoard} strokeWidth={2} />
      <Spines books={SHELF_BOTTOM.books} c={c} />
      <Rect x={0} y={196} width={W} height={8} fill={c.lineStrong} />
      <Sticky x={300} y={118} size={30} tilt={5} c={c} />
    </>
  );
}

/** E · 책갈피 리본 — 펼친 책 가운데 초록 리본. 가장 단순해 글씨를 얹기 좋다. */
function RibbonScene({ c }: Paint) {
  return (
    <>
      <Rect x={-10} y={-10} width={420} height={214} fill={c.lineStrong} />
      <Rect x={-10} y={-10} width={204} height={206} fill={c.surfaceRaised} stroke={c.line} strokeWidth={1} />
      <Rect x={206} y={-10} width={214} height={206} fill={c.surfaceRaised} stroke={c.line} strokeWidth={1} />
      {/* 책등 쪽 접힘 */}
      <Rect x={194} y={-10} width={12} height={206} fill={c.bookPage} />
      <Ln x1={200} y1={-10} x2={200} y2={196} stroke={c.lineStrong} strokeWidth={2} />
      <TextLines x={28} y={24} w={150} n={9} gap={15} seed={0} c={c} />
      <TextLines x={226} y={24} w={150} n={9} gap={15} seed={4} c={c} />
      <Marker x={226} y={80} w={94} h={10} c={c} />
      {/* 접힌 귀퉁이 */}
      <Path d="M374 -10 L374 34 L400 -10 Z" fill={c.paperAlt} stroke={c.line} strokeWidth={1} />
      {/* 리본 */}
      <Path d="M150 -10 h22 v172 l-11 -12 l-11 12 Z" fill={c.accent} opacity={0.75} />
      <Sticky x={300} y={120} size={34} tilt={7} c={c} />
    </>
  );
}

/** 독서 타이머 판 — 눈금 60개(5분마다 긴 눈금)와 12시부터 150°까지 잰 호. */
const DIAL = { cx: 118, cy: 96, r: 64 };
const DIAL_TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = ((i * 6 - 90) * Math.PI) / 180;
  const long = i % 5 === 0;
  const outer = DIAL.r - 2;
  const inner = outer - (long ? 8 : 4);
  return {
    x1: DIAL.cx + outer * Math.cos(a),
    y1: DIAL.cy + outer * Math.sin(a),
    x2: DIAL.cx + inner * Math.cos(a),
    y2: DIAL.cy + inner * Math.sin(a),
    long,
  };
});
const DIAL_ARC = (() => {
  const r = DIAL.r - 16;
  const end = ((150 - 90) * Math.PI) / 180;
  const x = DIAL.cx + r * Math.cos(end);
  const y = DIAL.cy + r * Math.sin(end);
  return `M${DIAL.cx} ${DIAL.cy - r} A${r} ${r} 0 0 1 ${x} ${y}`;
})();
const BOOK_STACK: readonly { w: number; tone: keyof ColorTokens }[] = [
  { w: 150, tone: 'bookBoard' },
  { w: 134, tone: 'memoPad' },
  { w: 142, tone: 'paperAlt' },
];

/** F · 독서 타이머 책상 — 재는 중인 타이머 · 안경 · 쌓인 책. 앱의 독서 시간 기록을 떠올리게. */
function TimerScene({ c }: Paint) {
  const { cx, cy, r } = DIAL;
  return (
    <>
      {[12, 36, 60, 84, 108, 132, 156, 180, 204].map((y) => (
        <Ln key={y} x1={0} y1={y} x2={W} y2={y} stroke={c.line} opacity={0.8} />
      ))}
      <Circle cx={cx} cy={cy} r={r + 8} fill={c.surfaceRaised} stroke={c.lineStrong} strokeWidth={1} />
      <Circle cx={cx} cy={cy} r={r} fill={c.surface} stroke={c.line} strokeWidth={1} />
      {DIAL_TICKS.map((t, i) => (
        <Ln key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={c.lineStrong} strokeWidth={t.long ? 1.5 : 1} />
      ))}
      <Path d={DIAL_ARC} fill="none" stroke={c.accent} strokeWidth={6} strokeLinecap="round" />
      <Ln x1={cx} y1={cy} x2={cx} y2={cy - r + 20} stroke={c.ink} strokeWidth={2} />
      <Circle cx={cx} cy={cy} r={4} fill={c.ink} />
      {/* 쌓인 책 — 아래부터 */}
      {BOOK_STACK.map((b, i) => {
        const x = 226 + i * 6;
        const y = 150 - i * 24;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={b.w} height={22} fill={c[b.tone] as string} stroke={c.lineStrong} strokeWidth={1} />
            <Ln x1={x + b.w - 14} y1={y + 4} x2={x + b.w - 14} y2={y + 18} stroke={c.mid} opacity={0.4} />
            <Ln x1={x + 8} y1={y + 11} x2={x + 60} y2={y + 11} stroke={c.mid} strokeWidth={2} opacity={0.4} />
          </G>
        );
      })}
      {/* 안경 */}
      <Circle cx={262} cy={62} r={14} fill="none" stroke={c.ink} strokeWidth={2} />
      <Circle cx={298} cy={62} r={14} fill="none" stroke={c.ink} strokeWidth={2} />
      <Path d="M276 62 q4 -5 8 0" fill="none" stroke={c.ink} strokeWidth={2} strokeLinecap="round" />
      <Sticky x={322} y={24} size={36} tilt={8} c={c} />
    </>
  );
}

/** 클럽마다 돌아가며 쓰는 장면 — 바탕색은 View 가 칠하고 그림은 그 위에. */
const SCENES: readonly { base: keyof ColorTokens; Draw: (p: Paint) => ReactElement }[] = [
  { base: 'bookBoard', Draw: TableScene },
  { base: 'surfaceRaised', Draw: ShelfScene },
  { base: 'bookBoard', Draw: RibbonScene },
  { base: 'paperAlt', Draw: TimerScene },
];

/**
 * 클럽 배경 — 호스트가 올린 사진이 있으면 그 사진, 없으면 앱 색 토큰만으로 그린 기본 배경.
 * 기본 배경은 책 모임 장면 넷(모임 테이블 · 책장 · 책갈피 리본 · 독서 타이머 책상)을 클럽 id(seed)로 돌려 써서
 * 같은 클럽은 늘 같은 그림, 목록에서 이웃한 클럽은 서로 다른 그림이 된다. 다크 모드에서는 같은 그림이 어두운 종이로 나온다.
 * 클럽 머리 · 목록 카드 · 추천 클럽 · 설정 미리보기가 함께 쓴다. 글씨를 얹는 쪽은 그 위에 종이색 그라데이션을 덮는다.
 */
export function ClubBackdrop({ uri, seed, style }: {
  uri?: string | null;
  seed: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, style as object]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

  const { base, Draw } = SCENES[Math.abs(seed) % SCENES.length];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors[base] as string }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Draw c={colors} />
      </Svg>
    </View>
  );
}
