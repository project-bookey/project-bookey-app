import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { pressedStyle } from '@/theme/tokens';
import { PEN_COLORS, penColorOf, type PenColor } from './noteDoc';

/**
 * 스와치 겉모습(28pt)은 그대로 두고 hitSlop 으로 터치를 넓힌다. 옆 스와치의 hitSlop 과 겹치지 않게 간격도 같이 벌린다.
 * - 기본: 세로 44 · 가로 36 (간격 sm) — 텍스트 편집 시트처럼 다른 컨트롤과 한 줄을 나눌 때.
 * - roomy: 44×44 (간격 lg) — 펜 줄처럼 자리를 넉넉히 쓸 수 있을 때.
 * 부모 상자 밖으로 나간 hitSlop 은 터치를 받지 못하므로, 줄 상자도 같은 만큼의 여백 + 음수 마진으로 넓힌다(자리는 그대로).
 */
const HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };
const HIT_SLOP_ROOMY = { top: 8, bottom: 8, left: 8, right: 8 };

/** 펜 색 6종 — 네모 스와치, 선택은 글자색 테두리. 펜 줄과 텍스트 편집 시트가 같이 쓴다. */
export function PenSwatches({ value, onChange, roomy = false }: {
  value: PenColor;
  onChange: (color: PenColor) => void;
  /** 44×44 터치를 다 채우도록 간격을 넓힌다. */
  roomy?: boolean;
}) {
  const { colors } = useTheme();
  const palette = penColorOf(colors);
  return (
    <View style={[styles.row, roomy ? styles.rowRoomy : null]}>
      {PEN_COLORS.map((c) => {
        const selected = value === c;
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            accessibilityRole="button"
            accessibilityLabel={`색 ${c}`}
            accessibilityState={{ selected }}
            hitSlop={roomy ? HIT_SLOP_ROOMY : HIT_SLOP}
            style={({ pressed }) => [
              styles.box,
              { borderColor: selected ? colors.text : 'transparent' },
              pressed && !selected ? pressedStyle : null,
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: palette[c] }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // 간격 = 양옆 hitSlop 의 합 — 터치 영역이 맞닿되 겹치지 않는다.
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginVertical: -spacing.sm,
    paddingHorizontal: spacing.xs,
    marginHorizontal: -spacing.xs,
  },
  rowRoomy: { gap: spacing.lg, paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm },
  // 고른 색의 테두리 상자(작은 누름 칸)와 그 안의 색 — 모서리가 겹쳐 보이게 안쪽은 한 단 작게 둥글린다.
  box: { width: 28, height: 28, borderWidth: 2, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 18, height: 18, borderRadius: radius.badge },
});
