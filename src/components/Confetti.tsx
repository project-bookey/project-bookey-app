import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

import { darkColors } from '@/theme';

const COLORS = [darkColors.accent, darkColors.warn, darkColors.danger, '#F5F5F5', '#7B6BB0'];
const COUNT = 40;

/** 축하 폭죽 — 의존성 없이 Animated 파티클. run이 true가 되는 순간 1회 재생. */
export function Confetti({ run }: { run: boolean }) {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const played = useRef(false);

  useEffect(() => {
    if (run && !played.current) {
      played.current = true;
      Animated.timing(progress, {
        toValue: 1,
        duration: 2600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [run, progress]);

  if (!run) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: COUNT }, (_, i) => {
        // 파티클별 고정 난수 대용 — 인덱스 기반 의사난수(재현 가능)
        const seed = (i * 9301 + 49297) % 233280 / 233280;
        const seed2 = (i * 233 + 977) % 1000 / 1000;
        const x = seed * width;
        const drift = (seed2 - 0.5) * 120;
        const size = 6 + seed2 * 6;
        const color = COLORS[i % COLORS.length];
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-40 - seed2 * 200, height + 40],
        });
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [x, x + drift] });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${360 + seed * 720}deg`],
        });
        const opacity = progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size * 0.5,
              backgroundColor: color,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }],
            }}
          />
        );
      })}
    </Animated.View>
  );
}
