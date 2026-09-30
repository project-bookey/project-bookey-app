import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { pressedStyle, spacing, typeScale, useTheme } from '@/theme';

export function CapsuleTabs<T extends string>({ items, value, onChange }: {
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.tab,
              { backgroundColor: selected ? colors.accent : colors.surfaceRaised },
              pressed && pressedStyle,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.label, { color: selected ? colors.onAccent : colors.textMuted }]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
      <View style={{ width: spacing.xs }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, alignItems: 'center' },
  tab: {
    minHeight: 38,
    minWidth: 72,
    paddingHorizontal: spacing.md,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typeScale.label, fontSize: 14, lineHeight: 18 },
});
