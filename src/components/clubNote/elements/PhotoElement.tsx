import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/theme';
import { PHOTO_FRAME, type PhotoElement as PhotoEl } from '../noteDoc';

/**
 * 사진 — 종이 프레임(폴라로이드) 위에 붙인다. 요소의 w·h 가 프레임 바깥 크기라 선택 프레임이 그대로 맞는다.
 * uri 를 주면 문서의 url 대신 쓴다(업로드 전 로컬 미리보기). pending 이면 위에 스피너를 얹는다.
 */
export function PhotoElement({ element, scale, uri, pending = false }: {
  element: Pick<PhotoEl, 'w' | 'h' | 'url'>;
  scale: number;
  uri?: string;
  pending?: boolean;
}) {
  const { colors, cardShadow } = useTheme();
  const inset = PHOTO_FRAME.inset * scale;
  const lip = PHOTO_FRAME.lip * scale;
  const w = element.w * scale;
  const h = element.h * scale;
  return (
    <View
      style={[
        {
          width: w,
          height: h,
          padding: inset,
          paddingBottom: lip,
          backgroundColor: colors.memoPad,
          borderRadius: radius.sm,
        },
        cardShadow,
      ]}
    >
      <Image
        source={{ uri: uri ?? element.url }}
        style={[styles.image, { backgroundColor: colors.surfaceRaised }]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      {pending ? (
        <View style={[StyleSheet.absoluteFill, styles.pending, { backgroundColor: `${colors.bg}b8` }]}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { flex: 1, width: '100%' },
  pending: { alignItems: 'center', justifyContent: 'center' },
});
