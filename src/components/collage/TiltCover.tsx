import { ReactNode, useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { coverShadow } from '@/theme/palette';
import { hairline, radius, serif, spacing, stagger, tiltFor } from '@/theme/tokens';

/** 입장 정착 스프링 — 은은하게 내려앉는 느낌. */
const SETTLE_SPRING = { damping: 15, stiffness: 110, mass: 1 };
/** 프레스 리프트 스프링 — 손가락에 붙는 느낌으로 조금 더 빠르게. */
const LIFT_SPRING = { damping: 18, stiffness: 220, mass: 0.6 };
/** 입장 시 아래에서 올라오는 거리(px). */
const SETTLE_RISE = 14;

/**
 * 콜라주 표지 — 표지 동적 효과의 단일 소스.
 *
 * 세 가지를 한 컴포넌트가 담당한다.
 * 1) 입장 정착: 마운트 1회, 인덱스만큼 지연된 스프링(opacity·translateY·rotate).
 * 2) 프레스 리프트: 누르면 살짝 커지고 기울기가 펴지며 그림자가 깊어진다.
 * 3) 콜라주 형태: 기울기·행 지그재그 오프셋·뒤에 겹친 표지 한 장.
 *
 * 그림자는 절대 직접 애니메이션하지 않는다(웹/안드로이드에서 미지원·저성능).
 * 대신 같은 크기의 '깊은 그림자' 프록시 뷰를 뒤에 깔고 opacity 만 애니메이션한다.
 */
export function TiltCover({
  uri,
  title,
  width = 96,
  tilt,
  index = 0,
  offsetY = 0,
  entering = true,
  stacked = false,
  onPress,
  children,
  accessibilityLabel,
}: {
  uri?: string | null;
  title?: string;
  width?: number;
  /** 기울기(도). 미지정이면 index 로 tilt 토큰을 순환 조회한다. */
  tilt?: number;
  /** 행 내 순서 — 입장 스태거 지연과 기본 기울기에 쓰인다. */
  index?: number;
  /** 행 지그재그용 세로 오프셋(px). */
  offsetY?: number;
  /** 입장 정착 애니메이션 여부. false 면 기울기·오프셋만 정적으로 적용. */
  entering?: boolean;
  /** 뒤에 표지 한 장을 더 겹쳐 스택처럼 보이게 한다. */
  stacked?: boolean;
  /** 지정하면 프레스 리프트가 켜진다. */
  onPress?: () => void;
  /** 표지 위에 얹을 오버레이 슬롯 — 랭크 배지·진행 바 등. */
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const { colors, mode } = useTheme();
  const height = Math.round(width * 1.5);
  const angle = tilt ?? tiltFor(index);

  // 0 → 1 로 한 번만 진행하는 입장 값. entering=false 면 처음부터 1.
  const progress = useSharedValue(entering ? 0 : 1);
  const pressed = useSharedValue(0);
  // FlatList 가 셀을 다시 붙여도(=effect 재실행) 입장 애니가 재발화하지 않도록 잠근다.
  const settled = useRef(false);

  useEffect(() => {
    if (settled.current) return;
    settled.current = true;
    if (!entering) {
      progress.value = 1;
      return;
    }
    const delay = Math.min(index, stagger.max) * stagger.step;
    progress.value = withDelay(delay, withSpring(1, SETTLE_SPRING));
    // 의도적으로 마운트 시 1회만 실행한다 — 의존성 배열을 채우면 재발화한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const frameStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const lift = pressed.value;
    return {
      opacity: p,
      transform: [
        { translateY: (1 - p) * SETTLE_RISE + offsetY },
        { scale: 1 + 0.04 * lift },
        // 누르는 동안 기울기가 펴진다 — 집어 올린 듯한 인상.
        { rotate: `${p * angle * (1 - lift)}deg` },
      ],
    };
  });

  // 깊은 그림자 프록시 — 그림자 속성 대신 opacity 만 움직인다.
  const liftedShadowStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));

  const body = (
    <Animated.View style={[{ width, height }, frameStyle]}>
      {stacked ? (
        // 뒤에 겹친 빈 표지 — 본 표지보다 5도 더 기울고 살짝 어긋나 있다.
        <View
          style={[
            styles.stack,
            {
              width,
              height,
              backgroundColor: colors.surfaceDeep,
              borderColor: colors.lineStrong,
              transform: [{ translateX: 7 }, { translateY: -6 }, { rotate: '5deg' }],
            },
          ]}
        />
      ) : null}

      <View
        style={[
          styles.frame,
          { width, height, backgroundColor: colors.surfaceDeep },
          coverShadow[mode].rest,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shadowProxy,
            { backgroundColor: colors.surfaceDeep },
            coverShadow[mode].lifted,
            liftedShadowStyle,
          ]}
        />

        <View style={[styles.surface, { borderColor: colors.line }]}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            // 무표지 폴백 — 세리프 제목을 표지처럼 앉힌다.
            <View style={styles.fallback}>
              <View style={[styles.fallbackRule, { backgroundColor: colors.textFaint }]} />
              <Text
                numberOfLines={3}
                style={[
                  styles.fallbackTitle,
                  {
                    color: colors.textMuted,
                    fontSize: Math.max(11, Math.round(width / 7)),
                    lineHeight: Math.max(15, Math.round(width / 5)),
                  },
                ]}
              >
                {title ?? '표지 없음'}
              </Text>
            </View>
          )}
        </View>

        {children ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {children}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );

  if (!onPress) {
    return (
      <View
        style={{ width, height }}
        accessible={Boolean(accessibilityLabel ?? title)}
        accessibilityLabel={accessibilityLabel ?? title}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(1, LIFT_SPRING);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, LIFT_SPRING);
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={{ width, height }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.sm },
  stack: { position: 'absolute', borderRadius: radius.sm, borderWidth: hairline },
  shadowProxy: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.sm },
  surface: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.sm,
    borderWidth: hairline,
    overflow: 'hidden',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  fallbackRule: { width: 16, height: 1.5 },
  fallbackTitle: { fontFamily: serif.bold, textAlign: 'center' },
});
