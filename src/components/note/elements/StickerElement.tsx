import { Image, Text, View } from 'react-native';

import { findBookeyChatSticker } from '@/components/chat/bookeyStickers';
import { useTheme } from '@/theme';
import type { StickerElement as StickerEl } from '../noteDoc';
import { findPackSticker } from '../stickerPack';
import { ActivityCardFace } from './ActivityCardFace';
import { BookStickerFace } from './BookStickerFace';

/**
 * 스티커 — 이모지는 글자로, 그림 팩은 테마 색으로 렌더한 SVG 로, 기록 카드는 담아 둔 스냅숏으로 그린 카드 면으로,
 * Bookey 이모티콘은 채팅과 같은 그림으로, 책은 담아 둔 표지로. 모르는 팩 키·이모티콘 코드는 빈 자리로 둔다(앞으로 호환).
 */
export function StickerElement({ element, scale }: { element: StickerEl; scale: number }) {
  const { colors } = useTheme();
  const size = element.w * scale;
  if (element.kind === 'card') {
    return element.card ? <ActivityCardFace card={element.card} size={size} /> : <View style={{ width: size, height: size }} />;
  }
  if (element.kind === 'book') {
    return element.book ? <BookStickerFace book={element.book} size={size} /> : <View style={{ width: size, height: size }} />;
  }
  if (element.kind === 'bookey') {
    const sticker = findBookeyChatSticker(element.value);
    return (
      <View style={{ width: size, height: size }}>
        {sticker ? (
          <Image source={sticker.source} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel={sticker.label} />
        ) : null}
      </View>
    );
  }
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
