import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

/**
 * 페이지 바탕 탭 — 요소들 **아래** 깔린다(먼저 그려진 형제). 요소 위를 누르면 요소가 받고, 빈 종이를 누르면 여기로 온다.
 * 선택 모드: 한 번 탭 = 선택 해제. 보기 모드: 두 번 탭 = 선택 모드로. 펜·지우개 땐 꺼 둔다(잉크 층이 위에서 다 받는다).
 */
export function PageTapLayer({ active, onTap, onDoubleTap }: {
  active: boolean;
  onTap: () => void;
  onDoubleTap: () => void;
}) {
  const latest = useRef({ onTap, onDoubleTap });
  latest.current = { onTap, onDoubleTap };
  const gesture = useMemo(() => {
    const double = Gesture.Tap().runOnJS(true).numberOfTaps(2).onEnd((_e, ok) => {
      if (ok) latest.current.onDoubleTap();
    });
    const single = Gesture.Tap().runOnJS(true).onEnd((_e, ok) => {
      if (ok) latest.current.onTap();
    });
    return Gesture.Exclusive(double, single);
  }, []);
  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} pointerEvents={active ? 'auto' : 'none'} />
    </GestureDetector>
  );
}
