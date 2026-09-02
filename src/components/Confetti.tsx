import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

import { useTheme } from '@/theme';

/**
 * 팔레트에 없는 유일한 리터럴 — 악센트(틸)·경고·위험만으로는 색이 세 갈래뿐이라
 * 폭죽이 단조로워진다. 어두운 책상과 밝은 종이 어느 쪽에서도 읽히는 보라 하나를
 * 더 섞는다(다크/라이트 배경 대비 모두 3:1 이상).
 */
const CONFETTI_VIOLET = '#7159AE';
const COUNT = 40;

/** 축하 폭죽 — 의존성 없이 Animated 파티클. run이 true가 되는 순간 1회 재생. */
export function Confetti({ run }: { run: boolean }) {
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const played = useRef(false);

  // 라이트 모드에서 흰 조각이 종이에 묻히던 문제 — 색을 테마에서 받는다.
  // (colors.text 는 다크에서 밝게, 라이트에서 어둡게 뒤집힌다.)
  const palette = useMemo(
    () => [colors.accent, colors.warn, colors.danger, colors.text, CONFETTI_VIOLET],
    [colors],
  );

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
        const color = palette[i % palette.length];
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
