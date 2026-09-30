import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlusGlyph } from '@/components/collage';
import { spacing, useTheme } from '@/theme';
import { hairline, mono, pressedStyle, radius } from '@/theme/tokens';

/**
 * 페이지 줄 — ‹ 이전 · `N / M` · 페이지 추가 · 다음 ›.
 * 보기 도구에선 스와이프로도 넘기지만, 도구를 쥔 동안(그리고 웹 마우스에선) 이 줄이 유일한 넘김 수단이다.
 * onAdd 를 안 주면(읽기 전용) 추가 버튼을 숨긴다.
 */
export function PageStrip({ index, count, onPrev, onNext, onAdd, canAdd = true }: {
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  onAdd?: () => void;
  canAdd?: boolean;
}) {
  const { colors } = useTheme();
  const hasPrev = index > 0;
  const hasNext = index < count - 1;
  return (
    <View style={styles.nav}>
      <NavLabel label="‹ 이전" onPress={onPrev} disabled={!hasPrev} color={colors.textMuted} />
      <View style={styles.center}>
        <Text style={[styles.count, { color: colors.textMuted }]} accessibilityLabel={`${count}쪽 중 ${index + 1}쪽`}>
          {index + 1} / {count}
        </Text>
        {onAdd ? (
          <Pressable
            onPress={onAdd}
            disabled={!canAdd}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="페이지 추가"
            accessibilityState={{ disabled: !canAdd }}
            style={({ pressed }) => [
              styles.add, { borderColor: colors.line }, !canAdd ? styles.disabled : null, pressed && canAdd ? pressedStyle : null,
            ]}
          >
            <PlusGlyph size={12} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <NavLabel label="다음 ›" onPress={onNext} disabled={!hasNext} color={colors.textMuted} align="right" />
    </View>
  );
}

function NavLabel({ label, onPress, disabled, color, align = 'left' }: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  color: string;
  align?: 'left' | 'right';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.navBtn, disabled ? styles.disabled : null, pressed && !disabled ? pressedStyle : null]}
    >
      <Text style={[styles.navLabel, { color, textAlign: align }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  navBtn: { minWidth: 56, paddingVertical: spacing.xs },
  navLabel: { fontFamily: mono.medium, fontSize: 11, letterSpacing: 0.5 },
  disabled: { opacity: 0.35 },
  center: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  count: { fontFamily: mono.medium, fontSize: 11, letterSpacing: 0.5 },
  add: { width: 20, height: 20, borderWidth: hairline, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
