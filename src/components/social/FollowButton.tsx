import { Pressable, StyleSheet, Text } from 'react-native';

import { useFollowToggle } from '@/hooks/useFollow';
import { useAuth } from '@/store/auth';
import { controlHeight, glassFace, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 팔로우 버튼 (§14.3) — 한 방향, 한 번 누르면 바로 팔로우되고 다시 누르면 취소된다.
 * 아직 안 했으면 잉크로 찍은 '팔로우', 하고 있으면 회색 톤의 '팔로잉' — 둘 다 공용 버튼과 같은 유리 면(glassFace).
 * sm 은 Button sm(32pt, hitSlop 으로 44pt), md 는 Button md(48pt)와 겉모습을 맞춘다.
 * 상대가 나를 팔로우하면(`followsMe`) 라벨이 맞팔로우 여부까지 알린다 — 안 했으면 '맞팔로우',
 * 서로 하고 있으면 '맞팔로우 중'. 그래서 버튼 옆에 '나를 팔로우'·'맞팔로우' 글자를 따로 두지 않는다.
 * 나 자신에게는 그리지 않는다. 상태를 모르는 동안(첫 로딩)에도 그리지 않아 깜빡이지 않는다.
 */
export function FollowButton({ userId, nickname, followsMe = false, size = 'sm' }: {
  userId: number;
  /** 보조 기술용 — '○○님 팔로우'로 읽힌다. */
  nickname?: string;
  /** 상대가 나를 팔로우하는지 — 내 팔로우 여부는 캐시(`followingIds`)에서 바로 읽으므로 누르는 즉시 라벨이 바뀐다. */
  followsMe?: boolean;
  size?: 'sm' | 'md';
}) {
  const { colors } = useTheme();
  const myId = useAuth((s) => s.user?.id);
  const { following, ready, pending, toggle } = useFollowToggle(userId);

  if (myId == null || myId === userId || !ready) return null;

  const who = nickname ? `${nickname}님 ` : '';
  const label = following ? (followsMe ? '맞팔로우 중' : '팔로잉') : (followsMe ? '맞팔로우' : '팔로우');
  return (
    <Pressable
      onPress={toggle}
      disabled={pending}
      hitSlop={size === 'sm' ? SM_HIT_SLOP : undefined}
      accessibilityRole="button"
      accessibilityLabel={following ? `${label}, ${who}팔로우 취소` : `${who}${label}`}
      accessibilityState={{ selected: following, busy: pending }}
      style={({ pressed }) => [
        styles.base,
        size === 'md' && styles.md,
        glassFace(colors, following ? colors.tonal : colors.ink),
        pressed && !pending && pressedStyle,
      ]}
    >
      <Text style={[styles.label, size === 'md' && styles.labelMd, { color: following ? colors.textMuted : colors.onInk }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 겉모습 32pt 를 위아래로 넓혀 44pt 터치 상자로 — Button sm 과 같은 값. */
const SM_HIT_SLOP = { top: (44 - controlHeight.sm) / 2, bottom: (44 - controlHeight.sm) / 2, left: 4, right: 4 };

const styles = StyleSheet.create({
  base: {
    minHeight: controlHeight.sm,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // 프로필 머리의 버튼 줄(Button md)과 키를 맞춘다.
  md: { minHeight: controlHeight.md, borderRadius: radius.md, paddingHorizontal: spacing.lg },
  label: { ...typeScale.label, fontSize: 12 },
  labelMd: { fontSize: 14 },
});
