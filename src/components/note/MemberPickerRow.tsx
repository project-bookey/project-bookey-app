import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { MemberProgress } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { controlFace, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/** 말풍선 화자 고르기 — 클럽 멤버 아바타 칩 가로 줄. 공용 Chip 과 같은 면(회색 톤)에 선택은 잉크 반전. */
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
            hitSlop={CHIP_HIT_SLOP}
            style={({ pressed }) => [
              styles.chip,
              controlFace(selected ? colors.ink : colors.tonal),
              pressed && !selected ? pressedStyle : null,
            ]}
          >
            <Avatar uri={m.avatarUrl} nickname={m.nickname} size={22} />
            <Text style={[typeScale.monoLabel, { color: selected ? colors.onInk : colors.text }]}>{m.nickname}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** 칩 겉모습(약 30pt)을 위아래로 넓혀 44pt 터치 상자로. */
const CHIP_HIT_SLOP = { top: 7, bottom: 7 };

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.control,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
