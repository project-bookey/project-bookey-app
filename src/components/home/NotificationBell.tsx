import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { notificationApi } from '@/api/endpoints';
import { radius, sans, useTheme } from '@/theme';

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
      <Image
        source={require('../../../assets/icons/bell.png')}
        style={[styles.icon, { tintColor: colors.text }]}
      />
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

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10 },
  // 구역 네비의 로고 마크(22)와 같은 크기 — 헤더 양끝이 같은 무게로 보이게.
  icon: { width: 22, height: 22, resizeMode: 'contain' },
});
