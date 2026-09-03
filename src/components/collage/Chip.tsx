import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';
import { hairline, radius, spacing, typeScale } from '@/theme/tokens';

/** 알약 칩 — 탐색 무드 칩·광장 필터 칩 공용. */
export function Chip({ label, active = false, onPress, disabled = false, accessibilityLabel }: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** 라벨과 다르게 읽혀야 할 때(예: 답글 대상 칩은 '답글 취소'). 없으면 라벨 그대로. */
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  // onPress 가 없으면 실제로 누를 수 없으므로 보조 기술에도 비활성으로 알린다.
  const inert = disabled || !onPress;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled: inert }}
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
