import { ReactNode, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { Animated, PanResponder, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useBottomTabBoundarySwipe } from '@/components/BottomTabSwipe';

const START_DISTANCE = 12;
const CHANGE_DISTANCE = 56;
const HORIZONTAL_RATIO = 1.35;

/** 화면 전환용 탭에 좌우 스와이프를 더한다. 세로 스크롤은 그대로 통과시킨다. */
export function SwipeableTabs<T extends string>({
  values, value, onChange, children, style,
}: {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const bottomTabSwipe = useBottomTabBoundarySwipe();
  const valueRef = useRef(value);
  valueRef.current = value;

  // 탭 네비게이터는 이전 화면을 메모리에 유지한다. 실제로 보이는 화면의 상단 탭만
  // 전체 스와이프 우선권을 가져야 숨겨진 탭이 좌우 이동을 막지 않는다.
  useFocusEffect(useCallback(
    () => bottomTabSwipe?.registerInnerTabs(),
    [bottomTabSwipe?.registerInnerTabs],
  ));

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > START_DISTANCE
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * HORIZONTAL_RATIO,
    onPanResponderMove: (_, gesture) => {
      const index = values.indexOf(valueRef.current);
      const atEdge = (gesture.dx > 0 && index === 0)
        || (gesture.dx < 0 && index === values.length - 1);
      translateX.setValue(atEdge ? gesture.dx * 0.2 : gesture.dx * 0.45);
    },
    onPanResponderRelease: (_, gesture) => {
      const index = values.indexOf(valueRef.current);
      const next = index + (gesture.dx < 0 ? 1 : -1);
      const shouldChange = Math.abs(gesture.dx) >= CHANGE_DISTANCE || Math.abs(gesture.vx) >= 0.55;
      Animated.spring(translateX, {
        toValue: 0, useNativeDriver: true, speed: 28, bounciness: 0,
      }).start();
      if (shouldChange && next >= 0 && next < values.length) onChange(values[next]);
      else if (shouldChange && next < 0) bottomTabSwipe?.move(-1);
      else if (shouldChange && next >= values.length) bottomTabSwipe?.move(1);
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, {
        toValue: 0, useNativeDriver: true, speed: 28, bounciness: 0,
      }).start();
    },
  }), [bottomTabSwipe, onChange, translateX, values]);

  return (
    <Animated.View {...pan.panHandlers} style={[styles.content, style, { transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
