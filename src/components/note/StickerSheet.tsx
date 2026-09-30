import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Segmented } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { pressedStyle } from '@/theme/tokens';
import { NoteSheet } from './NoteSheet';
import { EMOJI_STICKERS, STICKER_PACK } from './stickerPack';

type Tab = 'emoji' | 'pack';

/** 스티커 고르기 — 이모지 24종 / 그림 팩 12종. 한 번 누르면 바로 붙이고 닫힌다. */
export function StickerSheet({ visible, onPick, onClose }: {
  visible: boolean;
  onPick: (kind: Tab, value: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('emoji');
  return (
    <NoteSheet visible={visible} title="스티커" onClose={onClose}>
      <Segmented
        options={[{ value: 'emoji', label: '이모지' }, { value: 'pack', label: '그림' }]}
        value={tab}
        onChange={setTab}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.grid} keyboardShouldPersistTaps="handled">
        {tab === 'emoji'
          ? EMOJI_STICKERS.map((e) => (
              <Pressable
                key={e}
                onPress={() => onPick('emoji', e)}
                accessibilityRole="button"
                accessibilityLabel={`스티커 ${e}`}
                style={({ pressed }) => [styles.emojiCell, pressed ? pressedStyle : null]}
              >
                <Text style={styles.emoji}>{e}</Text>
              </Pressable>
            ))
          : STICKER_PACK.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => onPick('pack', s.key)}
                accessibilityRole="button"
                accessibilityLabel={`스티커 ${s.label}`}
                style={({ pressed }) => [styles.packCell, { borderColor: colors.line }, pressed ? pressedStyle : null]}
              >
                {s.render(44, colors)}
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>{s.label}</Text>
              </Pressable>
            ))}
      </ScrollView>
    </NoteSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 320 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiCell: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  emoji: { fontSize: 28, lineHeight: 36 },
  packCell: {
    width: 76,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
});
