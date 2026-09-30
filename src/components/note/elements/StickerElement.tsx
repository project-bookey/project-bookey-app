import { Text, View } from 'react-native';

import { useTheme } from '@/theme';
import type { StickerElement as StickerEl } from '../noteDoc';
import { findPackSticker } from '../stickerPack';

/** 스티커 — 이모지는 글자로, 그림 팩은 테마 색으로 렌더한 SVG 로. 모르는 팩 키는 빈 자리로 둔다(앞으로 호환). */
export function StickerElement({ element, scale }: { element: StickerEl; scale: number }) {
  const { colors } = useTheme();
  const size = element.w * scale;
  if (element.kind === 'pack') {
    const sticker = findPackSticker(element.value);
    return <View style={{ width: size, height: size }}>{sticker ? sticker.render(size, colors) : null}</View>;
  }
  return (
    <Text
      style={{
        width: size,
        height: size,
        fontSize: size * 0.78,
        lineHeight: size,
        textAlign: 'center',
        includeFontPadding: false,
      }}
    >
      {element.value}
    </Text>
  );
}
