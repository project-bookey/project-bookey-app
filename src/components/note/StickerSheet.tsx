import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clubCommunityApi } from '@/api/endpoints';
import type { ActivityCard } from '@/api/types';
import { Button, Loading, Segmented, formatClock, linkLabel } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { pressedStyle } from '@/theme/tokens';
import { NoteSheet } from './NoteSheet';
import { ActivityCardFace, snapshotOf } from './elements/ActivityCardFace';
import { EMOJI_STICKERS, STICKER_PACK } from './stickerPack';

type Tab = 'emoji' | 'pack' | 'card';

/** 카드 미리보기 한 변 — 시트 격자에서 두 장씩 놓인다. */
const CARD_PREVIEW = 132;

/**
 * 스티커 고르기 — 이모지 24종 / 그림 팩 12종 / 내 함께 독서 기록 카드(모든 클럽, 최근 50장).
 * 한 번 누르면 바로 붙이고 닫힌다. 카드 목록은 카드 탭을 열 때만 받는다.
 */
export function StickerSheet({ visible, onPick, onPickCard, onClose }: {
  visible: boolean;
  onPick: (kind: 'emoji' | 'pack', value: string) => void;
  onPickCard: (card: ActivityCard) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('emoji');
  const cards = useQuery({
    queryKey: ['activityCards', 'mine'],
    queryFn: clubCommunityApi.myActivityCards,
    enabled: visible && tab === 'card',
  });
  return (
    <NoteSheet visible={visible} title="스티커" onClose={onClose}>
      <Segmented
        options={[{ value: 'emoji', label: '이모지' }, { value: 'pack', label: '그림' }, { value: 'card', label: '기록 카드' }]}
        value={tab}
        onChange={setTab}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.grid} keyboardShouldPersistTaps="handled">
        {tab === 'card' ? (
          <CardTab cards={cards} onPick={onPickCard} />
        ) : tab === 'emoji'
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

/** 기록 카드 탭 — 로딩 / 오류(다시 시도) / 빈 상태 / 카드 면 격자. */
function CardTab({ cards, onPick }: {
  cards: { data?: ActivityCard[]; isLoading: boolean; isError: boolean; refetch: () => unknown };
  onPick: (card: ActivityCard) => void;
}) {
  const { colors } = useTheme();
  if (cards.isLoading) return <Loading />;
  if (cards.isError) {
    return (
      <View style={styles.cardNote}>
        <Text style={[typeScale.caption, { color: colors.textMuted }]}>기록 카드를 불러오지 못했어요.</Text>
        <Button label={linkLabel('다시 시도', 'action')} size="sm" variant="ghost" onPress={() => cards.refetch()} />
      </View>
    );
  }
  const list = cards.data ?? [];
  if (list.length === 0) {
    return (
      <Text style={[typeScale.caption, styles.cardNote, { color: colors.textMuted }]}>
        아직 기록 카드가 없어요. 클럽 모임에서 함께 독서를 끝내면 카드가 생겨요.
      </Text>
    );
  }
  return (
    <>
      {list.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onPick(c)}
          accessibilityRole="button"
          accessibilityLabel={`${c.clubName ?? '클럽'} 함께 독서 ${formatClock(c.durationSec)} 카드 붙이기`}
          style={({ pressed }) => (pressed ? pressedStyle : null)}
        >
          <ActivityCardFace card={snapshotOf(c)} size={CARD_PREVIEW} />
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  cardNote: { width: '100%', paddingVertical: spacing.md, alignItems: 'flex-start', gap: spacing.xs },
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
