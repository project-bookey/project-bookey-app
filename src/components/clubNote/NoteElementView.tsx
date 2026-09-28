import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { PlacedElement } from './noteDoc';
import { PhotoElement } from './elements/PhotoElement';
import { SpeechElement } from './elements/SpeechElement';
import { StickerElement } from './elements/StickerElement';
import { TextElement } from './elements/TextElement';

/** 요소 종류별 본체 — 편집 래퍼(제스처·선택 프레임)와 읽기 전용 뷰가 같이 쓴다. */
export function renderElementBody(element: PlacedElement, scale: number): ReactNode {
  switch (element.type) {
    case 'text':
      return <TextElement element={element} scale={scale} />;
    case 'sticker':
      return <StickerElement element={element} scale={scale} />;
    case 'photo':
      return <PhotoElement element={element} scale={scale} />;
    case 'speech':
      return <SpeechElement element={element} scale={scale} />;
    default:
      return null;
  }
}

/**
 * 요소 하나를 논리 좌표대로 놓는다 — absolute + rotate. RN 은 박스 중심을 축으로 돌리므로
 * 문서의 x·y 는 회전 전 박스의 좌상단이다(noteDoc 참고). 읽기 전용이라 터치를 받지 않는다.
 */
export function NoteElementView({ element, scale }: { element: PlacedElement; scale: number }) {
  return (
    <View
      pointerEvents="none"
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
}
