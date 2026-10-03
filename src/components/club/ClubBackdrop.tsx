import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Line, Rect } from 'react-native-svg';

import type { ColorTokens } from '@/theme';
import { useTheme } from '@/theme';
import { tiltFor } from '@/theme/tokens';

/** 기본 배경의 판 — 16:9 좌표에 그리고 slice 로 어느 띠에든 꽉 채운다. */
const W = 400;
const H = 225;

/** 판 바탕으로 쓸 종이 — 클럽마다 하나를 골라 목록에서 서로 달라 보이게 한다. */
const BASES: readonly (keyof ColorTokens)[] = ['paperAlt', 'bookBoard', 'surfaceRaised', 'memoPad'];

/**
 * 클럽 배경 — 호스트가 올린 사진이 있으면 그 사진, 없으면 앱 색 토큰만으로 그린 기본 배경(책상 위 콜라주:
 * 괘선 메모지 · 책등 · 스티키 한 장). 같은 클럽은 늘 같은 그림이 나오도록 seed(클럽 id)로 바탕 · 배치 · 기울기를 고른다.
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

  const base = colors[BASES[Math.abs(seed) % BASES.length]] as string;
  // 짝수 클럽은 책등을 오른쪽에, 홀수 클럽은 왼쪽에 — 배치를 뒤집어 같은 그림이 이어지지 않게.
  const flip = Math.abs(seed) % 2 === 1;
  const memoTilt = tiltFor(seed);
  const stickyTilt = tiltFor(seed + 3);
  const spines = [
    { w: 22, h: 150, fill: colors.lineStrong },
    { w: 16, h: 128, fill: colors.memoPad },
    { w: 26, h: 162, fill: colors.bookBoard },
    { w: 14, h: 118, fill: colors.line },
  ];

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: base }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <G transform={flip ? `translate(${W} 0) scale(-1 1)` : undefined}>
          {/* 책등 — 오른쪽에 세워 둔 책 몇 권 */}
          {spines.map((s, i) => {
            const x = 268 + spines.slice(0, i).reduce((sum, p) => sum + p.w + 3, 0);
            return (
              <Rect
                key={i}
                x={x}
                y={H - s.h}
                width={s.w}
                height={s.h}
                fill={s.fill}
                stroke={colors.line}
                strokeWidth={1}
              />
            );
          })}
          {/* 괘선 메모지 — 비스듬히 놓인 한 장 */}
          <G transform={`rotate(${memoTilt} 120 110)`}>
            <Rect x={40} y={46} width={168} height={128} fill={colors.memoPad} stroke={colors.line} strokeWidth={1} />
            {[78, 98, 118, 138].map((y) => (
              <Line key={y} x1={56} y1={y} x2={192} y2={y} stroke={colors.line} strokeWidth={1} />
            ))}
          </G>
          {/* 스티키 한 장 — 메모지 귀퉁이에 */}
          <Rect
            x={176}
            y={30}
            width={44}
            height={44}
            fill={colors.accentSoft}
            transform={`rotate(${stickyTilt} 198 52)`}
          />
        </G>
      </Svg>
    </View>
  );
}
