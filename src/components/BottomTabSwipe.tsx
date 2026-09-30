import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme';

type SwipeDirection = -1 | 1;
type BottomTabSwipeValue = {
  move: (direction: SwipeDirection) => void;
  registerInnerTabs: () => () => void;
};
const BottomTabSwipeContext = createContext<BottomTabSwipeValue | null>(null);

const ROUTES = ['/plaza', '/home', '/clubs', '/messenger', '/profile'] as const;
const START_DISTANCE = 14;
const CHANGE_DISTANCE = 64;

export function useBottomTabBoundarySwipe() {
  return useContext(BottomTabSwipeContext);
}

/** 메인 구역 전체를 종이 한 장처럼 좌우로 밀어 다음 하단 탭으로 전환한다. */
export function BottomTabSwipeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const moving = useRef(false);
  const [innerTabCount, setInnerTabCount] = useState(0);

  const activeIndex = ROUTES.findIndex((route) => pathname === route || pathname.startsWith(`${route}/`));

  const move = useCallback((direction: SwipeDirection) => {
    if (moving.current || activeIndex < 0) return;
    const next = activeIndex + direction;
    if (next < 0 || next >= ROUTES.length) {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 0 }).start();
      return;
    }
    moving.current = true;
    Animated.timing(translateX, {
      toValue: direction > 0 ? -width : width,
      duration: 70,
      useNativeDriver: true,
    }).start(() => {
      router.replace(ROUTES[next]);
      translateX.setValue(direction > 0 ? width : -width);
      requestAnimationFrame(() => {
        Animated.timing(translateX, {
          toValue: 0,
          duration: 90,
          useNativeDriver: true,
        }).start(() => { moving.current = false; });
      });
    });
  }, [activeIndex, router, translateX, width]);

  const registerInnerTabs = useCallback(() => {
    setInnerTabCount((count) => count + 1);
    return () => setInnerTabCount((count) => Math.max(0, count - 1));
  }, []);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      innerTabCount === 0
      && Math.abs(gesture.dx) > START_DISTANCE
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
    onPanResponderMove: (_, gesture) => {
      const atOuterEdge = (gesture.dx > 0 && activeIndex <= 0)
        || (gesture.dx < 0 && activeIndex === ROUTES.length - 1);
      translateX.setValue(atOuterEdge ? gesture.dx * 0.18 : gesture.dx);
    },
    onPanResponderRelease: (_, gesture) => {
      const shouldMove = Math.abs(gesture.dx) >= CHANGE_DISTANCE || Math.abs(gesture.vx) >= 0.55;
      if (shouldMove) move(gesture.dx < 0 ? 1 : -1);
      else Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 0 }).start();
    },
  }), [activeIndex, innerTabCount, move, translateX]);

  const contextValue = useMemo(() => ({ move, registerInnerTabs }), [move, registerInnerTabs]);

  return (
    <BottomTabSwipeContext.Provider value={contextValue}>
      <Animated.View
        {...pan.panHandlers}
        style={[styles.page, { backgroundColor: colors.bg, transform: [{ translateX }] }]}
      >
        {children}
      </Animated.View>
    </BottomTabSwipeContext.Provider>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, overflow: 'hidden' } });
