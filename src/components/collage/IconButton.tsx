import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { hairline, pressedStyle, radius, sans, useTheme } from '@/theme';

/** 아이콘 크기 — 상자 없는 버튼은 24, 유리 원 안은 원(40)에 맞춰 20. */
export const ICON_SIZE = { plain: 24, glass: 20 } as const;

const GLASS_SIZE = 40;
/** 유리 원(40)을 사방 2pt 넓혀 44pt 터치 상자로 만든다. */
const GLASS_HIT_SLOP = (44 - GLASS_SIZE) / 2;

/**
 * 아이콘 버튼 — 머리의 뒤로·종·톱니·채팅·⋯·실행 취소가 함께 쓴다(2026-10-05 버튼 비교 페이지 12-C·15-F).
 * 기본은 상자 없이 44pt 터치 상자에 아이콘 24. 사진 같은 배경 위에 떠 있을 때(`glass`)는 Apple 리퀴드 글래스처럼
 * 유리 원(40)에 아이콘 20 — iOS 26 은 진짜 유리(GlassView), 그 밖은 블러로 비슷하게 그린다. 탭 바와 같은 방식이다.
 * 아이콘은 children 으로 받는다(크기는 ICON_SIZE 를 따른다).
 */
export function IconButton({ onPress, accessibilityLabel, badge, glass = false, disabled = false, children }: {
  onPress: () => void;
  accessibilityLabel: string;
  /** 안 읽은 수 — 0 이면 숨긴다. 숫자 배지는 악센트를 쓰는 예외다. */
  badge?: number;
  glass?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { colors, mode } = useTheme();
  const badgeView = badge && badge > 0 ? (
    <View style={[styles.badge, glass ? styles.badgeOnGlass : null, { backgroundColor: colors.accent }]}>
      <Text style={[styles.badgeText, { color: colors.onAccent }]}>{badge > 9 ? '9+' : badge}</Text>
    </View>
  ) : null;

  if (!glass) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={disabled ? { disabled } : undefined}
        style={({ pressed }) => [styles.plain, disabled && styles.disabled, pressed && !disabled && pressedStyle]}
      >
        {children}
        {badgeView}
      </Pressable>
    );
  }

  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const edge = { borderColor: colors.glassEdge };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={GLASS_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled } : undefined}
      style={({ pressed }) => [styles.glassBox, disabled && styles.disabled, pressed && !disabled && pressedStyle]}
    >
      {nativeGlass ? (
        <GlassView isInteractive glassEffectStyle="clear" colorScheme="auto" tintColor={colors.glass} style={[styles.glassFace, edge]} />
      ) : (
        <BlurView
          intensity={60}
          tint={mode === 'dark' ? 'dark' : 'light'}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          style={[styles.glassFace, edge, { backgroundColor: colors.glass, boxShadow: `inset 0 1px 0 ${colors.glassHighlight}` }]}
        />
      )}
      {children}
      {badgeView}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plain: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  glassBox: {
    width: GLASS_SIZE,
    height: GLASS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    // 떠 있는 유리에만 두는 옅은 그림자 — 탭 바와 같은 예외(그림자 없음 규칙의 예외, 2026-10-05).
    boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
  },
  glassFace: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.round,
    borderWidth: hairline,
    overflow: 'hidden',
  },
  disabled: { opacity: 0.35 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeOnGlass: { top: -3, right: -3 },
  badgeText: { fontFamily: sans.bold, fontSize: 10 },
});
