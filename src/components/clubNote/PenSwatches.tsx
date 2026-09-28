import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { pressedStyle } from '@/theme/tokens';
import { PEN_COLORS, penColorOf, type PenColor } from './noteDoc';

/** 펜 색 6종 — 네모 스와치, 선택은 글자색 테두리. 펜 줄과 텍스트 편집 시트가 같이 쓴다. */
export function PenSwatches({ value, onChange }: { value: PenColor; onChange: (color: PenColor) => void }) {
  const { colors } = useTheme();
  const palette = penColorOf(colors);
  return (
    <View style={styles.row}>
      {PEN_COLORS.map((c) => {
        const selected = value === c;
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            accessibilityRole="button"
            accessibilityLabel={`색 ${c}`}
            accessibilityState={{ selected }}
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
  row: { flexDirection: 'row', gap: spacing.xs },
  box: { width: 28, height: 28, borderWidth: 2, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 18, height: 18, borderRadius: radius.sm },
});
