import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Banner } from '@/api/types';
import { darkColors, radius, spacing, typeScale, useTheme } from '@/theme';

const CARD_H = 108;

/**
 * 홈 최상단 이벤트 배너 — 가로 페이징 캐러셀 + 인디케이터.
 * 이미지 위 오버레이 영역이라 모드와 무관하게 어두운 톤(darkColors)을 쓴다.
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);

  if (banners.length === 0) {
    return null;
  }

  const open = (banner: Banner) => {
    if (!banner.linkUrl) return;
    if (/^https?:\/\//.test(banner.linkUrl)) {
      Linking.openURL(banner.linkUrl).catch(() => {});
    } else {
      router.push(banner.linkUrl as never);
    }
  };

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={banners}
          keyExtractor={(b) => String(b.id)}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              style={[styles.card, { width, backgroundColor: item.bgColor ?? darkColors.surfaceRaised }]} // 배너는 모드 무관 어두운 영역 — 폴백도 다크 고정
            >
              {item.imageUrl ? (
                <>
                  <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: darkColors.scrimDim }]} />
                </>
              ) : null}
              <View style={styles.cardBody}>
                <View style={[styles.tag, { backgroundColor: darkColors.accent }]}>
                  <Text style={[typeScale.overline, { color: darkColors.onAccent }]}>EVENT</Text>
                </View>
                <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: darkColors.text }]}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text numberOfLines={1} style={[typeScale.caption, { color: darkColors.textMuted }]}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      ) : null}

      {banners.length > 1 ? (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View
              key={b.id}
              style={[
                styles.dot,
                i === page
                  ? { width: 12, backgroundColor: colors.accent }
                  : { backgroundColor: colors.lineStrong },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.lg, gap: spacing.sm },
  card: { height: CARD_H, borderRadius: radius.md, overflow: 'hidden', justifyContent: 'flex-end' },
  cardBody: { padding: spacing.md, gap: 2 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { width: 4, height: 4, borderRadius: radius.pill },
});
