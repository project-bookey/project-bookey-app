import { StyleSheet, Text, View } from 'react-native';

import { hairline, spacing, typeScale, useTheme } from '@/theme';
import { mono, sans } from '@/theme/tokens';

export type StatCell = { label: string; value: string; unit?: string };

/**
 * 숫자 띠 — 활자·괘선 판면의 요약 줄. 위아래 괘선 사이를 칸으로 나누고
 * 칸마다 모노 아이브로우 라벨 아래 모노 숫자, 단위는 산세리프로 작게. 클럽 홈·모임 상세가 쓴다.
 */
export function StatStrip({ cells }: { cells: StatCell[] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.strip, { borderTopColor: colors.lineStrong, borderBottomColor: colors.line }]}>
      {cells.map((cell, i) => (
        <View
          key={cell.label}
          style={[
            styles.cell,
            i > 0 && { borderLeftWidth: hairline, borderLeftColor: colors.line, paddingLeft: spacing.md },
          ]}
        >
          <Text style={[styles.label, { color: colors.textFaint }]}>{cell.label}</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {cell.value}
            {cell.unit ? <Text style={[styles.unit, { color: colors.textMuted }]}>{cell.unit}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', borderTopWidth: hairline, borderBottomWidth: hairline },
  cell: { flex: 1, paddingVertical: 10, gap: 2 },
  label: { ...typeScale.monoEyebrow, fontSize: 9 },
  value: { fontFamily: mono.semiBold, fontSize: 17, lineHeight: 22 },
  unit: { fontFamily: sans.semiBold, fontSize: 11 },
});
