import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pressedStyle, radius, sans, useTheme } from '@/theme';

/** 아이콘 크기 — 상자 없는 아이콘 버튼은 모두 24. */
export const ICON_SIZE = 24;

/**
 * 아이콘 버튼 — 머리의 뒤로·톱니·채팅·⋯·실행 취소가 함께 쓴다(2026-10-05 버튼 비교 페이지 12-C).
 * 상자 없이 44pt 터치 상자에 아이콘 24, 눌림은 pressedStyle. 아이콘은 children 으로 받는다(크기는 ICON_SIZE).
 */
export function IconButton({ onPress, accessibilityLabel, badge, dot = false, disabled = false, children }: {
  onPress: () => void;
  accessibilityLabel: string;
  /** 안 읽은 수 — 0 이면 숨긴다. 숫자 배지는 악센트를 쓰는 예외다. */
  badge?: number;
  /** 숫자 없이 '새 것 있음'만 — 아이콘 오른쪽 위 초록 점(헤더 채팅 말풍선). 개수는 접근성 라벨에 담는다. */
  dot?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled } : undefined}
      style={({ pressed }) => [styles.box, disabled && styles.disabled, pressed && !disabled && pressedStyle]}
    >
      {children}
      {dot ? <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.bg }]} /> : null}
      {badge && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.badgeText, { color: colors.onAccent }]}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: sans.bold, fontSize: 10 },
  // 아이콘(24) 오른쪽 위 모서리에 걸친다 — 바탕색 테두리로 아이콘 선과 떼어 놓는다.
  dot: { position: 'absolute', top: 8, right: 7, width: 10, height: 10, borderRadius: radius.round, borderWidth: 2 },
});
