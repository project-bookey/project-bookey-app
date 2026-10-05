import { Pressable, StyleSheet, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { controlFace, useTheme } from '@/theme';
import { iconStroke, pressedStyle, radius, spacing, typeScale } from '@/theme/tokens';

/**
 * 칩 — 탐색 분야·문의 분류·서재 필터 공용. 꺼짐은 회색 톤, 켜짐은 잉크를 버튼과 같은 평평한 면(controlFace)으로 깐다
 * (2026-10-05 버튼 비교 페이지 — 부드러운 네모). 겉모습 약 31pt · 11px 은 그대로(사용자 결정).
 * 아이콘만 봐도 알 만한 칩(탐색의 담기 + · 담았어요 ✓)은 label 없이 icon 만 준다 — 읽어 줄 말은 accessibilityLabel.
 */
export function Chip({ label, icon: Icon, active = false, onPress, disabled = false, accessibilityLabel }: (
  | { label: string; icon?: undefined; accessibilityLabel?: string }
  | { label?: undefined; icon: LucideIcon; accessibilityLabel: string }
) & {
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  // onPress 가 없으면 실제로 누를 수 없으므로 보조 기술에도 비활성으로 알린다.
  const inert = disabled || !onPress;
  const fg = active ? colors.onInk : colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      hitSlop={Icon ? ICON_HIT_SLOP : CHIP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled: inert }}
      style={({ pressed }) => [
        styles.chip,
        Icon ? styles.iconOnly : null,
        controlFace(active ? colors.ink : colors.tonal),
        disabled ? styles.disabled : null,
        pressed && !inert && !active && pressedStyle,
      ]}
    >
      {Icon ? (
        <Icon size={ICON_PX} color={fg} {...iconStroke} />
      ) : (
        <Text style={[typeScale.monoLabel, { color: fg }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** 칩 겉모습(약 31pt)은 지키고 위아래로 넓혀 44pt 터치 상자를 만든다. */
const CHIP_HIT_SLOP = { top: 7, bottom: 7 };
/** 아이콘 칩은 폭도 31pt 라 좌우까지 넓힌다. */
const ICON_HIT_SLOP = { top: 7, bottom: 7, left: 7, right: 7 };
/** 아이콘 칩 — 위아래 sm 여백과 합쳐 글자 칩과 같은 높이(약 31pt)가 된다. */
const ICON_PX = 15;

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  // 아이콘만이면 가로도 위아래와 같은 여백 — 정사각에 가깝다. 터치 상자는 hitSlop 으로 44pt.
  iconOnly: { paddingHorizontal: spacing.sm },
  disabled: { opacity: 0.35 },
});
