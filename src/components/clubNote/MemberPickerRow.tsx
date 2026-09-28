import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { MemberProgress } from '@/api/types';
import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, pressedStyle } from '@/theme/tokens';

/** 말풍선 화자 고르기 — 모임 멤버 아바타 칩 가로 줄. 선택은 잉크 반전. */
export function MemberPickerRow({ members, selectedUserId, onPick }: {
  members: MemberProgress[];
  selectedUserId: number;
  onPick: (member: MemberProgress) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
      {members.map((m) => {
        const selected = m.userId === selectedUserId;
        return (
          <Pressable
            key={m.userId}
            onPress={() => onPick(m)}
            accessibilityRole="button"
            accessibilityLabel={`${m.nickname} 말풍선`}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.chip,
              selected
                ? { backgroundColor: colors.ink, borderColor: colors.ink }
                : { backgroundColor: 'transparent', borderColor: colors.line },
              pressed && !selected ? pressedStyle : null,
            ]}
          >
            <QuoteAvatar uri={m.avatarUrl} nickname={m.nickname} size={22} />
            <Text style={[typeScale.monoLabel, { color: selected ? colors.onInk : colors.text }]}>{m.nickname}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: hairline,
    borderRadius: radius.sm,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
