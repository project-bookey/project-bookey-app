import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

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
        <NotificationBell />
      </View>
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

function MailLine({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
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
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
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
  side: { width: 88, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  right: { alignItems: 'flex-end' },
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
