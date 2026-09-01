import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';
import { hairline, radius, spacing, typeScale } from '@/theme/tokens';

/** 알약 칩 — 탐색 무드 칩·광장 필터 칩 공용. */
export function Chip({ label, active = false, onPress, disabled = false }: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      style={[
        styles.chip,
        active
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: 'transparent', borderColor: colors.line },
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[typeScale.monoLabel, { color: active ? colors.onAccent : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  disabled: { opacity: 0.4 },
});
