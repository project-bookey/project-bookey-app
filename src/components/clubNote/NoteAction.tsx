import { Pressable, StyleSheet, Text } from 'react-native';

import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';

/** 캔버스 위에 뜨는 작은 동작 버튼 — 선택 프레임의 삭제·맨 앞으로·편집, 업로드 실패 사진의 다시·지우기. */
export function NoteAction({ label, onPress, tone = 'default' }: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: colors.surface, borderColor: colors.lineStrong },
        pressed ? pressedStyle : null,
      ]}
    >
      <Text style={[typeScale.monoLabel, { color: tone === 'danger' ? colors.danger : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { borderWidth: hairline, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
});
