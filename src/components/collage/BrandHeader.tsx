import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { walletApi } from '@/api/endpoints';
import { NotificationBell } from '@/components/home/NotificationBell';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

export function BrandHeader() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <HeaderIconButton
          label="엽서함"
          onPress={() => router.push('/postcards')}
          icon={<MailLine color={colors.text} />}
        />
        <HeaderIconButton
          label="채팅"
          onPress={() => router.push('/chats')}
          icon={<ChatLine color={colors.text} />}
        />
      </View>
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
      <Text style={styles.bookmarkMark}>🔖</Text>
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
        <Text style={[styles.plusText, { color: colors.accent }]}>+</Text>
      </Pressable>
    </View>
  );
}

function HeaderIconButton({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        { borderColor: colors.line, backgroundColor: pressed ? colors.surfaceRaised : 'transparent' },
      ]}
    >
      {icon}
    </Pressable>
  );
}

// 장식용 아이콘 — aria-hidden 은 RN 이 네이티브 접근성 숨김으로 옮기고 웹은 그대로 쓴다.
// (accessibilityElementsHidden 은 react-native-svg 웹에서 DOM 에 새어 React 경고가 뜬다)
function MailLine({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path
        d="M4.5 6.75h15v10.5h-15z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m5.25 7.5 6.75 5 6.75-5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChatLine({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path
        d="M5.25 6.75h13.5v8.25h-8.4L6.5 18.25V15h-1.25z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  left: {
    width: 88,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.xs,
    zIndex: 2,
  },
  side: { width: 118, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  right: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  bookmarkPill: {
    height: 32,
    minWidth: 74,
    maxWidth: 92,
    borderRadius: radius.pill,
    borderWidth: hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.sm,
    paddingRight: 4,
    gap: 4,
  },
  bookmarkMark: { fontSize: 14, lineHeight: 16 },
  bookmarkCount: { ...typeScale.monoLabel, flex: 1, textAlign: 'right', fontSize: 11, lineHeight: 14 },
  plusButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  plusText: { fontSize: 24, lineHeight: 24, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
