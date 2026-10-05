import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CachedImage as Image } from '@/components/CachedImage';

import { controlFace, pressedStyle, radius, sans, spacing, useTheme } from '@/theme';
import { BOOKEY_STICKER_PACKS } from './bookeyStickers';

/**
 * 이모티콘 묶음 고르기 — 캐릭터 썸네일과 이름을 단 가로 줄. 1:1 채팅과 노트 스티커가 같이 쓴다.
 * 칸은 공용 칩과 같은 면 — 꺼짐은 회색 톤, 고른 묶음은 다른 선택 상태처럼 잉크로 뒤집는다.
 */
export function BookeyPackTabs({ value, onChange }: { value: string; onChange: (packId: string) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.list}
    >
      {BOOKEY_STICKER_PACKS.map((pack) => {
        const selected = pack.id === value;
        return (
          <Pressable
            key={pack.id}
            onPress={() => onChange(pack.id)}
            accessibilityRole="tab"
            accessibilityLabel={`${pack.name} 이모티콘`}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.tab,
              controlFace(selected ? colors.ink : colors.tonal),
              pressed ? pressedStyle : null,
            ]}
          >
            <Image source={pack.thumbnail} style={styles.thumb} contentFit="contain" />
            <Text numberOfLines={1} style={[styles.name, { color: selected ? colors.onInk : colors.textMuted }]}>
              {pack.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs, paddingBottom: spacing.xs },
  tab: {
    width: 64,
    minHeight: 66,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  thumb: { width: 42, height: 42 },
  name: { fontFamily: sans.regular, fontSize: 10, lineHeight: 13 },
});
