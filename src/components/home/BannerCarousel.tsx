import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { Banner } from '@/api/types';
import { openLink } from '@/lib/linkTarget';
import { darkColors, hairline, layout, radius, sans, spacing, typeScale, useTheme } from '@/theme';
import { InlineMarkdownText } from './InlineMarkdownText';

const CARD_H = 108;

/**
 * 홈 최상단 이벤트 배너 — 가로 페이징 캐러셀 + 인디케이터.
 * 이미지 위 오버레이 영역이라 모드와 무관하게 어두운 톤(darkColors)을 쓴다.
 * 배너가 없으면 같은 높이의 '이벤트 준비 중' 스트립으로 자리를 지킨다(홈 빈 섹션 스펙).
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const { colors } = useTheme();
  const [page, setPage] = useState(0);
  // 카드 폭은 창 폭에서 바로 계산한다(홈 본문 최대 폭 − 좌우 여백). 웹에서 onLayout 이 첫 폭을
  // 0 으로 주고 다시 안 불러 리스트가 영영 안 그려지던 결함 — 실측값이 오면 그 값을 우선한다.
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const width = measured > 0 ? measured : Math.min(window.width, layout.content.maxWidth) - spacing.lg * 2;

  if (banners.length === 0) {
    return (
      <View style={[styles.wrap, styles.placeholder, { borderColor: colors.lineStrong }]}>
        <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>이벤트 준비 중</Text>
      </View>
    );
  }

  const open = (banner: Banner) => {
    openLink(banner.linkUrl);
  };

  return (
    <View style={styles.wrap} onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          horizontal
          pagingEnabled
          style={styles.list}
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
                {/* 홈의 악센트는 히어로 CTA 몫 — 태그는 잉크 도장으로 둔다. */}
                <View style={[styles.tag, { backgroundColor: darkColors.ink }]}>
                  <Text style={[typeScale.monoEyebrow, { color: darkColors.onInk }]}>EVENT</Text>
                </View>
                <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: darkColors.text }]}>
                  <InlineMarkdownText text={item.title} strongStyle={styles.titleStrong} />
                </Text>
                {item.subtitle ? (
                  <Text numberOfLines={1} style={[typeScale.caption, { color: darkColors.textMuted }]}>
                    <InlineMarkdownText text={item.subtitle} strongStyle={styles.subtitleStrong} />
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
                  ? { width: 12, backgroundColor: colors.ink }
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
  // 가로 리스트는 웹에서 높이가 0 으로 접힐 수 있다 — 카드 높이를 명시해 세 플랫폼이 같은 자리를 잡는다.
  list: { height: CARD_H },
  card: { height: CARD_H, borderRadius: radius.md, overflow: 'hidden', justifyContent: 'flex-end' },
  cardBody: { padding: spacing.md, gap: 2 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  placeholder: {
    height: CARD_H,
    borderRadius: radius.md,
    borderWidth: hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { width: 4, height: 4, borderRadius: radius.none },
  titleStrong: { fontFamily: sans.bold },
  subtitleStrong: { fontFamily: sans.semiBold },
});
