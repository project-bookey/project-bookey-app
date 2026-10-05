import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@/navigation';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { notificationApi } from '@/api/endpoints';
import { iconStroke, pressedStyle, radius, sans, useTheme } from '@/theme';

/** 헤더 우측 종 — 미열람 수 배지, 누르면 알림 화면. */
export function NotificationBell() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: notificationApi.list });
  const unread = data?.content.filter((n) => !n.openedAt).length ?? 0;

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={BELL_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel="알림"
      style={({ pressed }) => (pressed ? pressedStyle : null)}
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

/**
 * 종 글리프(24)를 사방 10pt 넓혀 44pt 터치 상자로 만든다 — 왼쪽 지갑 상자(44)와는 spacing.md 로 떨어져 겹치지 않는다.
 * 다른 아이콘 버튼(IconButton)처럼 44 상자를 쓰지 않는 건, 가운데 워드마크 옆 자리(118)에 지갑과 함께 들어가야 해서다.
 */
const BELL_HIT_SLOP = 10;

/** 종 — 아이콘 버튼 크기(24, 2026-10-05). 래스터 PNG 였던 것을 다른 아이콘과 같은 각진 획으로 그린다. */
function BellGlyph({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
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
