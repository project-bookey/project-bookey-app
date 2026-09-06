import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { motion, radius, useTheme } from '@/theme';

/** 강조 테두리가 사라지는 데 걸리는 시간(ms). */
const FADE_MS = 2000;

/**
 * 다른 화면에서 찍고 온 카드에 한 번만 지나가는 강조 테두리
 * (광장의 밑줄 카드 · 도서 상세의 '오려둔 문장' 조각이 함께 쓴다).
 *
 * 카드 레이아웃·터치를 건드리지 않도록 겹쳐 놓는 테두리로만 만든다 — 절대 배치라
 * 카드 높이가 변하지 않고, `pointerEvents="none"` 이라 '좋아요'·'삭제'를 가리지 않는다.
 * 마운트가 곧 시작이고, 다 지워지면 부모의 강조 상태를 스스로 풀어 두 번 돌지 않는다.
 *
 * 절대 배치의 기준은 부모의 안쪽(패딩) 상자다 — 테두리가 카드 안쪽 가장자리에 딱 붙는다.
 * 모서리 곡률만 카드마다 다르므로 `borderRadius` 로 맞춰 준다.
 */
export function FocusRing({ onDone, borderRadius = radius.lg }: {
  /** 강조가 다 지워졌다 — 부모가 강조 상태를 푼다. */
  onDone: () => void;
  /** 감싸는 카드의 곡률. 기본값은 카드(radius.lg), 메모 조각은 radius.sm. */
  borderRadius?: number;
}) {
  const { colors } = useTheme();
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withSequence(
      withTiming(1, { duration: motion.fast, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) runOnJS(onDone)();
      }),
    );
    // 페이드 도중에 카드가 사라지면 완료 콜백의 runOnJS 가 주인 없이 발화한다 —
    // 애니메이션을 먼저 끊어 콜백 자체를 없앤다(HomeScraps 와 같은 규율).
    return () => cancelAnimation(glow);
  }, [glow, onDone]);

  const style = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ring, { borderColor: colors.accent, borderRadius }, style]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
  },
});
