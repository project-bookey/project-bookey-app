import { type ReactNode, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue, interpolate, useAnimatedStyle, Extrapolation } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { iconStroke, pressedStyle, radius, sans, spacing, useTheme } from '@/theme';

export type SwipeAction = {
  key: string;
  label: string;
  icon: 'block' | 'trash';
  /** danger 는 연한 빨강 면에 빨간 아이콘·글자, neutral 은 회색 톤 면. */
  tone: 'neutral' | 'danger';
  onPress: () => void;
  accessibilityLabel?: string;
};

/** 단추 한 변 — 줄 높이가 달라도(채팅 72, 알림 86+) 가운데에 같은 크기로 선다. */
const KEY = 60;

/** 열린 쟁반 폭 — 단추들 + 사이(sm) + 양옆 여백(md). 이 폭의 절반을 넘겨 놓아야 열린다. */
function trayWidth(count: number) {
  return KEY * count + spacing.sm * (count - 1) + spacing.md * 2;
}
/** 빨리 놓았을 때의 튕김 — 기본값(질량 2·감쇠 1000)은 너무 무겁게 멈춰 굼떠 보였다. */
const SPRING = { mass: 1, damping: 28, stiffness: 320, overshootClamping: true } as const;

/** 지금 열려 있는 줄 — 한 줄을 열면 열려 있던 다른 줄은 닫는다(목록이 달라도 한 화면엔 하나). */
let openRow: SwipeableMethods | null = null;

/**
 * 밀어서 여는 줄(2026-10-05 시안 D, 사용자 결정) — 왼쪽으로 밀면 오른쪽에서 연한 면 + 아이콘 단추가 차례로 떠오른다
 * (차단은 회색 톤 면, 삭제는 연한 빨강 면에 빨간 아이콘·글자).
 * 채팅 목록·엽서 목록(차단·삭제)과 알림(삭제)이 같이 쓴다. 제스처는 화면 스레드에서 도는 ReanimatedSwipeable 이라
 * 손가락을 바로 따라오고, 반쯤 넘기거나 빠르게 튕기면 열리며, 끝에서는 고무줄처럼 조금만 더 늘어난다.
 * 제스처만으로 되는 기능은 두지 않는다 — 같은 동작을 화면 어딘가에 눈에 보이는 단추로 꼭 함께 둔다.
 */
export function SwipeRow({ actions, onClose, children }: {
  actions: SwipeAction[];
  /** 줄이 닫힐 때 — '한 번 더' 같은 대기 상태를 풀 때 쓴다. */
  onClose?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<SwipeableMethods>(null);
  const { colors } = useTheme();
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1}
      overshootRight
      overshootFriction={6}
      rightThreshold={trayWidth(actions.length) / 2}
      animationOptions={SPRING}
      // 줄 뒤에 바탕색을 깐다 — 손가락이 닿은 동안 줄이 눌림 표시(반투명)로 바뀌어도 뒤의 단추가 비치지 않게.
      childrenContainerStyle={{ backgroundColor: colors.bg }}
      onSwipeableWillOpen={() => {
        if (openRow && openRow !== ref.current) openRow.close();
        openRow = ref.current;
      }}
      onSwipeableClose={() => {
        if (openRow === ref.current) openRow = null;
        onClose?.();
      }}
      renderRightActions={(progress) => (
        <View style={styles.tray}>
          {actions.map((action, index) => (
            <TrayKey key={action.key} action={action} index={index} count={actions.length} progress={progress} />
          ))}
        </View>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

/** 닫는 손잡이 — 차단을 취소했을 때처럼 줄을 코드에서 닫아야 할 때 쓴다. */
export function closeOpenSwipeRow() {
  openRow?.close();
}

/** 쟁반의 단추 하나 — 미는 정도(progress)에 따라 먼저 드러나는 오른쪽 것부터 차례로 옆에서 떠오른다. */
function TrayKey({ action, index, count, progress }: {
  action: SwipeAction;
  index: number;
  count: number;
  progress: SharedValue<number>;
}) {
  const { colors } = useTheme();
  const danger = action.tone === 'danger';
  const face = danger ? colors.dangerSoft : colors.tonal;
  const ink = danger ? colors.danger : colors.text;
  const start = (count - 1 - index) * 0.2;
  const style = useAnimatedStyle(() => {
    const q = interpolate(progress.value, [start, start + 0.8], [0, 1], Extrapolation.CLAMP);
    return { opacity: q, transform: [{ translateX: (1 - q) * 18 }] };
  });
  const stroke = { stroke: ink, ...iconStroke };
  return (
    <Animated.View style={style}>
      <Pressable
        onPress={action.onPress}
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel ?? action.label}
        style={({ pressed }) => [styles.key, { backgroundColor: face }, pressed ? pressedStyle : null]}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
          {action.icon === 'block' ? (
            <>
              <Circle cx={12} cy={12} r={8.5} {...stroke} />
              <Path d="m6 6 12 12" {...stroke} />
            </>
          ) : (
            <Path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10.25 10.5v6M13.75 10.5v6" {...stroke} />
          )}
        </Svg>
        <Text numberOfLines={1} style={[styles.label, { color: ink }]}>{action.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tray: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  key: {
    width: KEY,
    height: KEY,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: { fontFamily: sans.semiBold, fontSize: 11.5 },
});
