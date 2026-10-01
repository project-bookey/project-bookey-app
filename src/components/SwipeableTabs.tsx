import { ReactNode, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleProp, StyleSheet, ViewStyle } from 'react-native';

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
  const valueRef = useRef(value);
  valueRef.current = value;

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => {
      const index = values.indexOf(valueRef.current);
      const headsToOuterPager = (gesture.dx > 0 && index === 0)
        || (gesture.dx < 0 && index === values.length - 1);
      return !headsToOuterPager
        && Math.abs(gesture.dx) > START_DISTANCE
        && Math.abs(gesture.dx) > Math.abs(gesture.dy) * HORIZONTAL_RATIO;
    },
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
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, {
        toValue: 0, useNativeDriver: true, speed: 28, bounciness: 0,
      }).start();
    },
  }), [onChange, translateX, values]);

  return (
    <Animated.View {...pan.panHandlers} style={[styles.content, style, { transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
