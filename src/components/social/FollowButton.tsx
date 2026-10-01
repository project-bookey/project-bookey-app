import { Pressable, StyleSheet, Text } from 'react-native';

import { useFollowToggle } from '@/hooks/useFollow';
import { useAuth } from '@/store/auth';
import { hairline, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 팔로우 버튼 (§14.3) — 한 방향, 한 번 누르면 바로 팔로우되고 다시 누르면 취소된다.
 * 아직 안 했으면 잉크로 찍은 '팔로우', 하고 있으면 헤어라인만 남은 '팔로잉'.
 * 나 자신에게는 그리지 않는다. 상태를 모르는 동안(첫 로딩)에도 그리지 않아 깜빡이지 않는다.
 */
export function FollowButton({ userId, nickname, size = 'sm' }: {
  userId: number;
  /** 보조 기술용 — '○○ 팔로우'로 읽힌다. */
  nickname?: string;
  size?: 'sm' | 'md';
}) {
  const { colors } = useTheme();
  const myId = useAuth((s) => s.user?.id);
  const { following, ready, pending, toggle } = useFollowToggle(userId);

  if (myId == null || myId === userId || !ready) return null;

  const who = nickname ? `${nickname} ` : '';
  return (
    <Pressable
      onPress={toggle}
      disabled={pending}
      hitSlop={size === 'sm' ? 10 : 4}
      accessibilityRole="button"
      accessibilityLabel={following ? `${who}팔로우 취소` : `${who}팔로우`}
      accessibilityState={{ selected: following, busy: pending }}
      style={({ pressed }) => [
        styles.base,
        size === 'md' && styles.md,
        following
          ? { backgroundColor: 'transparent', borderColor: colors.lineStrong }
          : { backgroundColor: colors.ink, borderColor: colors.ink },
        pressed && !pending && pressedStyle,
      ]}
    >
      <Text style={[typeScale.monoLabel, { color: following ? colors.textMuted : colors.onInk }]}>
        {following ? '팔로잉' : '팔로우'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // 프로필 머리의 버튼 줄(Button md)과 키를 맞춘다.
  md: { minHeight: 46, paddingHorizontal: spacing.lg },
});
