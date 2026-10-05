import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { walletApi } from '@/api/endpoints';
import { PlusGlyph } from '@/components/collage/PlusGlyph';
import { NotificationBell } from '@/components/home/NotificationBell';
import { useTourTarget } from '@/components/tour/TourTarget';
import { glassFace, iconStroke, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 구역 화면 공통 헤더 — 가운데 워드마크, 오른쪽에 책갈피 잔액·알림 종.
 * 왼쪽에 있던 엽서함·채팅 아이콘은 하단 '메신저' 구역으로 옮겨 갔다(2026-09-08) — 워드마크는
 * 절대 위치로 가운데에 서므로 왼쪽이 비어도 자리가 흔들리지 않는다.
 *
 * 왼쪽 자리는 광장에서만 쓴다 — 독후감 쓰기 연필(`showCompose`). 광장 피드 위에 있던
 * '독후감' 제목·'+ 독후감' 줄을 걷어내고 여기로 옮겼다(사용자 결정 2026-10-05, 시안 C).
 * 비어 있어도 자리(side)는 늘 두어 오른쪽 묶음이 구역마다 흔들리지 않는다.
 */
export function BrandHeader({ showCompose = false }: {
  /** 왼쪽에 독후감 쓰기 연필을 둘지 — 광장이 보이는 동안만 켠다. */
  showCompose?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text
        pointerEvents="none"
        style={[typeScale.display, styles.wordmark, { color: colors.text }]}
      >
        BOOKEY
      </Text>
      <View style={[styles.side, styles.left]}>
        {showCompose ? <ComposeButton /> : null}
      </View>
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
  const tourRef = useTourTarget('header-bookmarks');

  // 잔액 칩 전체가 하나의 버튼이다 — 24pt '+' 만 누르게 하면 손가락이 빗나간다(UX 철칙 Fitts).
  // 색은 글자색 — 헤더는 다섯 구역에 늘 떠 있어 악센트를 쓰면 화면마다 CTA 와 겹친다.
  return (
    <Pressable
      ref={tourRef}
      onPress={() => router.push('/bookmarks')}
      hitSlop={BADGE_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`책갈피 ${balance}개, 구매하기`}
      style={({ pressed }) => [
        styles.bookmarkBadge,
        glassFace(colors, colors.tonal),
        pressed && styles.pressed,
      ]}
    >
      <BookmarkGlyph color={colors.textMuted} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[styles.bookmarkCount, { color: colors.text }]}
      >
        {balance}
      </Text>
      <View style={styles.plusButton}>
        <PlusGlyph size={14} stroke={2.5} color={colors.text} />
      </View>
    </Pressable>
  );
}

/**
 * 독후감 쓰기 — 광장 전용. 아이콘만 있는 헤더 버튼이라 옆의 종처럼 글자색 획으로 그린다
 * (악센트는 화면 속 CTA 몫이다). 둘러보기 광장 단계가 이 버튼을 비춘다.
 */
function ComposeButton() {
  const router = useRouter();
  const { colors } = useTheme();
  const tourRef = useTourTarget('plaza-compose');

  return (
    <Pressable
      ref={tourRef}
      onPress={() => router.push('/post/new')}
      accessibilityRole="button"
      accessibilityLabel="독후감 쓰기"
      style={({ pressed }) => [styles.composeButton, pressed && styles.pressed]}
    >
      <PencilGlyph color={colors.text} />
    </Pressable>
  );
}

/** 연필 — 종(24)과 같은 크기, 같은 각진 획. */
function PencilGlyph({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path d="M5 18.5 6.2 14 15.8 4.4a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8L10 17.8z" stroke={color} {...iconStroke} />
      <Path d="m14.5 5.8 3.7 3.7" stroke={color} {...iconStroke} />
    </Svg>
  );
}

/** 잔액 칩(32pt)을 위아래로 넓혀 44pt 터치 상자로 만든다. 옆의 종과 겹치지 않게 좌우는 넓히지 않는다. */
const BADGE_HIT_SLOP = { top: 6, bottom: 6 };

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
    justifyContent: 'space-between',
    position: 'relative',
  },
  side: { width: 118, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  left: { alignItems: 'flex-start' },
  right: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md },
  bookmarkBadge: {
    height: 32,
    minWidth: 74,
    maxWidth: 92,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    gap: spacing.xs,
  },
  bookmarkCount: { ...typeScale.monoLabel, flex: 1, textAlign: 'right', fontSize: 11, lineHeight: 14 },
  plusButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  // 44pt 터치 상자 — 왼쪽으로 되돌려 연필이 화면 여백 선(spacing.lg)에 맞춰 선다.
  composeButton: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  pressed: pressedStyle,
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
