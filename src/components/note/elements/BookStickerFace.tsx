import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { radius, serif, useTheme } from '@/theme';
import { hairline, mono } from '@/theme/tokens';
import { BOOK_STICKER_RATIO, type BookStickerSnapshot } from '../noteDoc';

/** 무표지 면 비율 — 폭(size)에 대한 값. 220 논리 폭에서 제목 약 26, 저자 약 15. */
const F = { pad: 0.1, rule: 0.16, title: 0.12, author: 0.07, gap: 0.06 };

/**
 * 책 표지 스티커 면 — 표지 사진 한 장(헤어라인). 표지가 없거나 받지 못하면 명조 제목·저자를 앉힌 빈 표지.
 * 노트 스티커와 스티커 고르기 미리보기가 같은 면을 쓴다. 모든 치수가 폭에 비례해 줌 배율을 그대로 따른다.
 */
export function BookStickerFace({ book, size }: { book: BookStickerSnapshot; size: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const cover = !failed ? book.coverUrl : undefined;
  return (
    <View
      style={[
        styles.face,
        { width: size, height: size * BOOK_STICKER_RATIO, backgroundColor: colors.surfaceDeep, borderColor: colors.lineStrong },
      ]}
    >
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.fallback, { padding: size * F.pad, gap: size * F.gap }]}>
          <View style={{ width: size * F.rule, height: Math.max(1, size * 0.012), backgroundColor: colors.textFaint }} />
          <Text
            numberOfLines={4}
            style={{
              fontFamily: serif.bold,
              fontSize: size * F.title,
              lineHeight: size * F.title * 1.35,
              textAlign: 'center',
              color: colors.textMuted,
            }}
          >
            {book.title}
          </Text>
          {book.author ? (
            <Text
              numberOfLines={1}
              style={{ fontFamily: mono.medium, fontSize: size * F.author, textAlign: 'center', color: colors.textFaint }}
            >
              {book.author}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { borderWidth: hairline, borderRadius: radius.sm, overflow: 'hidden' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
