import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { walletApi } from '@/api/endpoints';
import { PlusGlyph } from '@/components/collage/PlusGlyph';
import { NotificationBell } from '@/components/home/NotificationBell';
import { hairline, iconStroke, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 구역 화면 공통 헤더 — 가운데 워드마크, 오른쪽에 책갈피 잔액·알림 종.
 * 왼쪽에 있던 엽서함·채팅 아이콘은 하단 '메신저' 구역으로 옮겨 갔다(2026-09-08) — 워드마크는
 * 절대 위치로 가운데에 서므로 왼쪽이 비어도 자리가 흔들리지 않는다.
 */
export function BrandHeader() {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text
        pointerEvents="none"
        style={[typeScale.display, styles.wordmark, { color: colors.text }]}
      >
        BOOKEY
      </Text>
      <View style={[styles.side, styles.right]}>
        <BookmarkBalance />
        <NotificationBell />
      </View>
    </View>
  );
}

function BookmarkBalance() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data } = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const balance = data?.bookmarkBalance ?? 0;

  return (
    <View style={[styles.bookmarkPill, { borderColor: colors.line, backgroundColor: colors.surface }]}>
      <BookmarkGlyph color={colors.accent} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[styles.bookmarkCount, { color: colors.text }]}
      >
        {balance}
      </Text>
      <Pressable
        onPress={() => router.push('/bookmarks')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`책갈피 ${balance}개, 구매하기`}
        style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}
      >
        <PlusGlyph size={14} stroke={2.5} color={colors.accent} />
      </Pressable>
    </View>
  );
}

/** 책갈피 — 이모지는 플랫폼마다 그림이 달라 선으로 직접 그린다. 끝은 각지게. */
function BookmarkGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h12v18l-6-4.5L6 21z" stroke={color} {...iconStroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 62,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  side: { width: 118, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  right: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  bookmarkPill: {
    height: 32,
    minWidth: 74,
    maxWidth: 92,
    borderRadius: radius.sm,
    borderWidth: hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.sm,
    paddingRight: 4,
    gap: 4,
  },
  bookmarkCount: { ...typeScale.monoLabel, flex: 1, textAlign: 'right', fontSize: 11, lineHeight: 14 },
  plusButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  wordmark: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: 0,
  },
});
