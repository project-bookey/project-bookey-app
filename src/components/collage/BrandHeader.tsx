import { StyleSheet, Text, View } from 'react-native';

import { NotificationBell } from '@/components/home/NotificationBell';
import { spacing, typeScale, useTheme } from '@/theme';

export function BrandHeader() {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.side} />
      <Text style={[typeScale.display, styles.wordmark, { color: colors.text }]}>BOOKEY</Text>
      <View style={[styles.side, styles.right]}>
        <NotificationBell />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 62,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  wordmark: { fontSize: 26, lineHeight: 34, letterSpacing: 0 },
});
