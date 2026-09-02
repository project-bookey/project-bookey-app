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

/** 뒤장 어긋남 — 본 표지 프레임 좌표계(기울기 포함) 기준. px·도·배율. */
export type StackOffset = { x: number; y: number; rotate: number; scale: number };
/** 기본 뒤장 — 본 표지보다 5도 더 기울고 살짝 어긋난 겹침. */
const STACK_DEFAULT: StackOffset = { x: 7, y: -6, rotate: 5, scale: 1 };

/**
 * 이미 입장 애니를 마친 표지 키 모음 — 앱 세션 동안만 사는 메모리 캐시다
 * (영속 저장 아님, 앱을 다시 켜면 비어 있다).
 *
 * 가상화 리스트는 화면 밖 셀을 언마운트했다가 다시 마운트한다. 그때 컴포넌트
 * 인스턴스가 새로 생기므로 인스턴스 내부 ref 가드만으로는 입장 애니 재발화를
 * 막을 수 없다. 화면이 안정적인 키(예: `popular:123`)를 넘기면 두 번째부터는
 * 스태거 지연 없이 곧바로 정착 상태로 그린다.
 */
const enteredKeys = new Set<string>();

/**
 * 표지 입장 정착 진행값(0 → 1)을 만든다.
 *
 * 표지 옆 활자처럼 **표지와 같은 리듬으로 함께 정착해야 하는 요소**가 있으면
 * 같은 index·entranceKey 로 이 훅을 호출한다 — 스태거 지연과 1회성 가드가
 * 이 한 곳에만 있게 해서 타이밍이 어긋나지 않는다.
 *
 * 키 등록은 effect 에서, 입장 여부 판정은 render 에서 한다. 같은 커밋에서
 * 같은 키로 여러 번 호출해도 판정이 모두 render 단계에 끝나므로 함께 입장한다.
 */
export function useCoverEntrance(index = 0, entranceKey?: string, entering = true) {
  // 이미 한 번 입장한 표지는(키가 있을 때) 다시 마운트돼도 정착 상태로 시작한다.
  const shouldEnter = entering && !(entranceKey != null && enteredKeys.has(entranceKey));

  // 0 → 1 로 한 번만 진행하는 입장 값. 입장이 필요 없으면 처음부터 1.
  const progress = useSharedValue(shouldEnter ? 0 : 1);
  // 같은 인스턴스에서 effect 가 다시 돌아도(스트릭트 모드 등) 재발화하지 않도록 잠근다.
  const settled = useRef(false);

  useEffect(() => {
    if (settled.current) return;
    settled.current = true;
    if (!shouldEnter) {
      progress.value = 1;
      return;
    }
    if (entranceKey != null) enteredKeys.add(entranceKey);
    const delay = Math.min(index, stagger.max) * stagger.step;
    progress.value = withDelay(delay, withSpring(1, SETTLE_SPRING));
    // 의도적으로 마운트 시 1회만 실행한다 — 의존성 배열을 채우면 재발화한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return progress;
}

/** 이 폭 미만은 '소폭 표지'로 보고 폴백 활자를 좁은 판에 맞춰 줄인다. */
const FALLBACK_COMPACT_W = 56;

/**
 * 무표지 폴백의 활자·여백을 표지 폭에서 계산한다.
 *
 * 기본 수식(w/7 · 행간 w/5)은 96px 같은 큰 표지를 기준으로 잡혀 있어서, 모임 만들기
 * 책 픽커(38px)처럼 좁은 표지에서는 3줄이 표지 높이를 넘겨 잘렸다. 소폭에서는 구
 * BookCover 비율(w/6.5)과 타이트한 행간으로 낮추고, 여백을 좁히고 장식 괘선을 생략해
 * 판 안에 들어오게 한다. 56px 이상은 종전 그대로다 — 96px 기준 모양은 변하지 않는다.
 */
function fallbackMetrics(width: number) {
  if (width < FALLBACK_COMPACT_W) {
    const fontSize = Math.max(8, Math.round(width / 6.5));
    return { fontSize, lineHeight: fontSize + 3, padding: 4, gap: 0, rule: false };
  }
  return {
    fontSize: Math.max(11, Math.round(width / 7)),
    lineHeight: Math.max(15, Math.round(width / 5)),
    padding: spacing.sm,
    gap: spacing.sm,
    rule: true,
  };
}

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
  entranceKey,
  stacked = false,
  stackOffset,
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
  /**
   * 표지를 세션 단위로 식별하는 키(예: `popular:123`).
   * 넘기면 리스트 재활용으로 재마운트돼도 입장 애니가 한 번만 돈다.
   * 미지정이면 마운트마다 입장한다(기존 동작).
   */
  entranceKey?: string;
  /** 뒤에 표지 한 장을 더 겹쳐 스택처럼 보이게 한다. */
  stacked?: boolean;
  /**
   * 뒤장의 어긋남. 기본은 살짝 어긋난 겹침이고, 히어로처럼 부채꼴로 펼치려면
   * x·rotate 를 키운다. 값은 본 표지 프레임 좌표(기울기 적용 후) 기준. `stacked` 일 때만 쓰인다.
   */
  stackOffset?: Partial<StackOffset>;
  /** 지정하면 프레스 리프트가 켜진다. */
  onPress?: () => void;
  /** 표지 위에 얹을 오버레이 슬롯 — 랭크 배지·진행 바 등. */
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const { colors, mode } = useTheme();
  const height = Math.round(width * 1.5);
  const angle = tilt ?? tiltFor(index);
  const fallback = fallbackMetrics(width);
  const stack = { ...STACK_DEFAULT, ...stackOffset };

  const progress = useCoverEntrance(index, entranceKey, entering);
  const pressed = useSharedValue(0);

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
        // 뒤에 겹친 빈 표지 — 기본은 살짝 어긋난 겹침, stackOffset 으로 부채꼴까지 펼친다.
        // 그림자는 본 표지와 같은 rest — 펼쳐졌을 때 뒤장도 종이처럼 떠 보이게.
        <View
          style={[
            styles.stack,
            {
              width,
              height,
              backgroundColor: colors.surfaceDeep,
              borderColor: colors.lineStrong,
              transform: [
                { translateX: stack.x },
                { translateY: stack.y },
                { rotate: `${stack.rotate}deg` },
                { scale: stack.scale },
              ],
            },
            coverShadow[mode].rest,
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
        {/*
          안드로이드는 elevation 이 큰 형제를 위로 올려 그린다 — 프록시(불투명 사각형)가
          표지·배지를 덮어버린다. elevation 0 인 래퍼로 한 겹 감싸 스택 순서 경쟁을
          래퍼 안쪽으로 가둔다. 래퍼 자체는 문서 순서대로 표지 뒤에 남고 그림자는 유지된다.
        */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              styles.shadowProxy,
              { backgroundColor: colors.surfaceDeep },
              coverShadow[mode].lifted,
              liftedShadowStyle,
            ]}
          />
        </View>

        <View style={[styles.surface, { borderColor: colors.line }]}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            // 무표지 폴백 — 세리프 제목을 표지처럼 앉힌다.
            <View style={[styles.fallback, { padding: fallback.padding, gap: fallback.gap }]}>
              {fallback.rule ? (
                <View style={[styles.fallbackRule, { backgroundColor: colors.textFaint }]} />
              ) : null}
              <Text
                numberOfLines={3}
                style={[
                  styles.fallbackTitle,
                  {
                    color: colors.textMuted,
                    fontSize: fallback.fontSize,
                    lineHeight: fallback.lineHeight,
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
  // 여백·간격은 폭에 따라 fallbackMetrics 가 정한다.
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackRule: { width: 16, height: 1.5 },
  fallbackTitle: { fontFamily: serif.bold, textAlign: 'center' },
});
