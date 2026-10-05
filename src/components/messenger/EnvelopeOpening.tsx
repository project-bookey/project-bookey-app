import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { layout, motion, spacing, useTheme } from '@/theme';

/** 봉투 폭의 상한 — 넓은 화면(웹·태블릿)에서도 엽서보다 작게 둔다. */
const MAX_WIDTH = 280;
/** 봉투 높이 = 폭 × 이 비율(우편 봉투 비례). 날개는 높이의 절반을 조금 넘게 내려온다. */
const RATIO = 0.62;
const FLAP = 0.56;

/**
 * 엽서를 처음 열 때의 짧은 효과(2026-10-05 사용자 결정) — 닫힌 봉투의 날개가 젖혀지고, 엽서가 위로 올라오며 나타나고,
 * 봉투는 아래로 빠지며 사라진다. 화면 전환이 끝나도록 motion.slow 만큼 닫힌 봉투를 보여 준 뒤 motion.slow 동안 연다.
 * 화면 스레드(reanimated)에서 transform·opacity 만 움직인다. '동작 줄이기'가 켜져 있거나 play 가 아니면 바로 다 열린 모양이다.
 * 봉투는 장식이라 스크린 리더에서 숨긴다 — 엽서 내용(children)은 처음부터 읽힌다.
 */
export function EnvelopeOpening({ play, children }: { play: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const animate = play && !reduceMotion;
  const progress = useSharedValue(animate ? 0 : 1);

  const width = Math.min(MAX_WIDTH, screenWidth - spacing.lg * 2);
  const height = Math.round(width * RATIO);
  const flapHeight = Math.round(height * FLAP);

  useEffect(() => {
    if (!animate) return;
    progress.value = withDelay(
      motion.slow,
      withTiming(1, { duration: motion.slow, easing: Easing.out(Easing.cubic) }),
    );
    // 마운트할 때 한 번만 연다 — 이 화면에서 다시 열지 않는다.
  }, []);

  // 날개는 위 끝을 축으로 뒤집는다 — 가운데 기준 scaleY 앞뒤로 반 높이만큼 옮겨 축을 위 끝으로 올린다.
  const flapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -flapHeight / 2 },
      { scaleY: interpolate(progress.value, [0, 0.45], [1, -1], Extrapolation.CLAMP) },
      { translateY: flapHeight / 2 },
    ],
  }));
  const envelopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.45, 1], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0.45, 1], [0, height], Extrapolation.CLAMP) }],
  }));
  const letterStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.35, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0.35, 1], [spacing.xxl, 0], Extrapolation.CLAMP) }],
  }));

  if (!play) return <>{children}</>;

  return (
    <View>
      <Animated.View style={letterStyle}>{children}</Animated.View>
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        // 젖힌 날개가 봉투 위로 올라설 자리(flapHeight)를 남기고 엽서 위에 겹쳐 그린다.
        style={[styles.envelope, { top: flapHeight, width, height }, envelopeStyle]}
      >
        <View style={[styles.body, { backgroundColor: colors.surface, borderColor: colors.lineStrong }]} />
        <Animated.View style={[styles.flap, { height: flapHeight }, flapStyle]}>
          <Svg width={width} height={flapHeight} viewBox={`0 0 ${width} ${flapHeight}`}>
            <Path
              d={`M0.5 0.5L${width / 2} ${flapHeight - 1}L${width - 0.5} 0.5`}
              fill={colors.surfaceRaised}
              stroke={colors.lineStrong}
              strokeWidth={1}
              strokeLinejoin="miter"
            />
            <Circle cx={width / 2} cy={flapHeight - 8} r={6} fill={colors.textMuted} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  envelope: { position: 'absolute', alignSelf: 'center', maxWidth: layout.content.maxWidth },
  body: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: 1 },
  flap: { position: 'absolute', top: 0, left: 0, right: 0 },
});
