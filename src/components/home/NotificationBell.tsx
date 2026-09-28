import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { notificationApi } from '@/api/endpoints';
import { iconStroke, radius, sans, useTheme } from '@/theme';

/** 헤더 우측 종 — 미열람 수 배지, 누르면 알림 화면. */
export function NotificationBell() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: notificationApi.list });
  const unread = data?.content.filter((n) => !n.openedAt).length ?? 0;

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="알림"
    >
      <BellGlyph color={colors.text} />
      {unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.badgeText, { fontFamily: sans.bold, color: colors.onAccent }]}>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** 종 — 구역 네비의 로고 마크(22)와 같은 크기. 래스터 PNG 였던 것을 다른 아이콘과 같은 각진 획으로 그린다. */
function BellGlyph({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z" stroke={color} {...iconStroke} />
      <Path d="M10 21h4" stroke={color} {...iconStroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10 },
});
