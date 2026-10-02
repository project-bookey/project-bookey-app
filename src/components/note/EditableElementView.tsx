import { memo, useMemo, useRef } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { renderElementBody } from './NoteElementView';
import { IDLE_DELTA, type Delta, type Preview } from './editing';
import { isTextual, type PlacedElement } from './noteDoc';

export type ElementHandlers = {
  onSelect: (id: string) => void;
  /** 텍스트·말풍선·문장 더블탭 — 편집 시트를 연다. */
  onEdit: (id: string) => void;
  onPreview: (preview: Preview) => void;
  /** 제스처 하나가 끝났을 때 — 지금까지의 델타를 문서에 적용한다. */
  onCommit: (id: string, delta: Delta) => void;
  /** 실제 렌더 높이(px) — 선택 프레임과 모서리 핸들이 쓴다. */
  onMeasure: (id: string, height: number) => void;
};

/**
 * 선택 도구용 요소 — 탭(선택)·더블탭(편집)·드래그·핀치·회전을 받는다. 전부 JS 스레드에서 돌며(runOnJS)
 * 진행 중엔 부모의 preview 상태만 바꾸고, 손을 떼면 델타를 커밋한다. element 는 이미 preview 가 얹힌 값이다.
 * editable 이 아니면 터치를 받지 않는다(보기 모드에서 페이지 넘김이 방해받지 않게).
 */
export const EditableElementView = memo(function EditableElementView({
  element, scale, editable, handlers,
}: {
  element: PlacedElement;
  scale: number;
  editable: boolean;
  handlers: ElementHandlers;
}) {
  const latest = useRef(handlers);
  latest.current = handlers;
  const delta = useRef<Delta>({ ...IDLE_DELTA });
  const id = element.id;

  const gesture = useMemo(() => {
    const push = () => latest.current.onPreview({ id, ...delta.current });
    const end = () => {
      latest.current.onCommit(id, { ...delta.current });
      delta.current = { ...IDLE_DELTA };
    };
    const canEdit = isTextual(element);
    const tap = Gesture.Tap().runOnJS(true).maxDuration(250).onEnd((_e, ok) => {
      if (ok) latest.current.onSelect(id);
    });
    const doubleTap = Gesture.Tap().runOnJS(true).numberOfTaps(2).enabled(canEdit).onEnd((_e, ok) => {
      if (ok) latest.current.onEdit(id);
    });
    const pan = Gesture.Pan().runOnJS(true).minDistance(4).maxPointers(1).averageTouches(true)
      .activeCursor('grabbing')
      .onStart(() => latest.current.onSelect(id))
      .onChange((e) => {
        delta.current.dx += e.changeX;
        delta.current.dy += e.changeY;
        push();
      })
      .onEnd(end);
    const pinch = Gesture.Pinch().runOnJS(true)
      .onChange((e) => {
        delta.current.s *= e.scaleChange;
        push();
      })
      .onEnd(end);
    const rotation = Gesture.Rotation().runOnJS(true)
      .onChange((e) => {
        delta.current.dr += (e.rotationChange * 180) / Math.PI;
        push();
      })
      .onEnd(end);
    return Gesture.Race(Gesture.Exclusive(doubleTap, tap), Gesture.Simultaneous(pan, pinch, rotation));
  }, [id, element.type]);

  const onLayout = (e: LayoutChangeEvent) => latest.current.onMeasure(id, e.nativeEvent.layout.height);

  const view = (
    <View
      onLayout={onLayout}
      pointerEvents={editable ? 'auto' : 'none'}
      style={{
        position: 'absolute',
        left: element.x * scale,
        top: element.y * scale,
        width: element.w * scale,
        transform: [{ rotate: `${element.rot}deg` }],
      }}
    >
      {renderElementBody(element, scale)}
    </View>
  );
  return editable ? <GestureDetector gesture={gesture}>{view}</GestureDetector> : view;
});
