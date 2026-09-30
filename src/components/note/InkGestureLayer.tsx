import { StyleSheet, View, type ViewStyle } from 'react-native';
import { GestureDetector, type PanGesture } from 'react-native-gesture-handler';

/** 웹 전용 커서 — RN 타입엔 'crosshair' 가 없어 우회한다. 네이티브는 무시한다. */
const crosshair = { cursor: 'crosshair' } as unknown as ViewStyle;
/** 웹에서 손가락으로 그릴 때 문서가 스크롤되지 않게. */
const noTouchAction = { touchAction: 'none' } as unknown as ViewStyle;

/**
 * 펜·지우개가 손을 대는 층 — 페이지 위를 통째로 덮는다. 활성일 때만 터치를 받고,
 * 아닐 때는 pointerEvents 를 꺼서 아래 요소(선택 도구)로 터치가 내려가게 한다.
 */
export function InkGestureLayer({ gesture, active }: { gesture: PanGesture; active: boolean }) {
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[StyleSheet.absoluteFill, noTouchAction, active ? crosshair : null]}
        pointerEvents={active ? 'auto' : 'none'}
      />
    </GestureDetector>
  );
}
