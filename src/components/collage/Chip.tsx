import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';
import { hairline, pressedStyle, radius, spacing, typeScale } from '@/theme/tokens';

/** 네모 칩 — 탐색 무드 칩·광장 필터 칩 공용. 활성은 잉크로 찍은 도장처럼 반전한다. */
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
      hitSlop={CHIP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled: inert }}
      style={({ pressed }) => [
        styles.chip,
        active
          ? { backgroundColor: colors.ink, borderColor: colors.ink }
          : { backgroundColor: 'transparent', borderColor: colors.control },
        disabled ? styles.disabled : null,
        pressed && !inert && !active && pressedStyle,
      ]}
    >
      <Text style={[typeScale.monoLabel, { color: active ? colors.onInk : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 칩 겉모습(약 31pt)은 지키고 위아래로 넓혀 44pt 터치 상자를 만든다. */
const CHIP_HIT_SLOP = { top: 7, bottom: 7 };

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.sm,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  disabled: { opacity: 0.4 },
});
