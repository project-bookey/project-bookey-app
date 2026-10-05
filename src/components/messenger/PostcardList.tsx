import { useQuery } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { walletApi } from '@/api/endpoints';
import type { PostcardView } from '@/api/types';
import { PersonGlyph } from '@/components/Avatar';
import { NAV_CLEARANCE } from '@/components/collage';
import { PostcardWalletLine } from '@/components/social/PostcardWalletLine';
import { EmptyState, Tag, TextLink, formatRelative } from '@/components/ui';
import { useRouter } from '@/navigation';
import { useAuth } from '@/store/auth';
import { usePostcardOpened } from '@/store/postcardOpened';
import { hairline, iconStroke, layout, pressedStyle, spacing, typeScale, useTheme } from '@/theme';

import { PostcardEnvelope } from './PostcardEnvelope';
import { usePostcards } from './postcardQueries';

export { mergePostcards } from './postcardQueries';

const COLUMN_COUNT = 3;

/** 봉투 목록: 본문·답장은 상세 화면에서만 보여 준다. */
export function PostcardList() {
  const [pulling, setPulling] = useState(false);
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const list = usePostcards();
  const items = useMemo(() => {
    const cards = list.data ?? [];
    const emptyCount = (COLUMN_COUNT - cards.length % COLUMN_COUNT) % COLUMN_COUNT;
    return emptyCount ? [...cards, ...Array<null>(emptyCount).fill(null)] : cards;
  }, [list.data]);
  const pull = async () => {
    setPulling(true);
    try { await Promise.all([list.refetch(), wallet.refetch()]); }
    finally { setPulling(false); }
  };

  return (
    <FlatList
      key={`postcards-${COLUMN_COUNT}-columns`}
      data={items}
      numColumns={COLUMN_COUNT}
      columnWrapperStyle={styles.columns}
      keyExtractor={(card, index) => card ? String(card.id) : `empty-postcard-slot-${index}`}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} />}
      ListHeaderComponent={wallet.data ? (
        <View style={styles.wallet}>
          <PostcardWalletLine freeToday={wallet.data.freePostcardsLeftToday}
            postcards={wallet.data.postcardBalance} stamps={wallet.data.stampBalance} />
        </View>
      ) : null}
      renderItem={({ item }) => item ? <PostcardRow card={item} /> : <View style={styles.emptySlot} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={list.isLoading ? null : list.isError ? (
        <EmptyState title="엽서를 불러오지 못했어요"
          action={<TextLink label="다시 시도" kind="action" onPress={() => list.refetch()} />} />
      ) : (
        <EmptyState title="아직 주고받은 엽서가 없어요" description="광장에서 마음에 드는 독후감에 엽서를 보내 보세요." />
      )}
    />
  );
}

function PostcardRow({ card }: { card: PostcardView }) {
  const router = useRouter();
  const { colors } = useTheme();
  const userId = useAuth((state) => state.user?.id);
  const read = usePostcardOpened((state) => userId != null && state.opened[`${userId}:${card.id}`] === true);
  const inbox = !card.mine;
  const name = inbox ? card.fromNickname : card.toNickname;
  const avatar = inbox ? card.fromAvatarUrl : card.toAvatarUrl;
  const replied = card.status === 'REPLIED';
  const opened = !inbox || read || replied;
  const status = !inbox ? '보낸 엽서' : opened ? '읽은 엽서' : '새 엽서';
  const Direction = inbox ? Mail : Send;
  return (
    <Pressable
      onPress={() => router.push(`/postcard/${card.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${inbox ? `${name}에게서` : `${name}에게`}, ${status}${replied ? ', 답장 완료' : ''}, 엽서 열기`}
      style={({ pressed }) => [styles.envelope, { backgroundColor: colors.surface, borderColor: colors.line }, pressed && pressedStyle]}
    >
      <View style={styles.head}>
        {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : (
          <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}>
            <PersonGlyph size={24} color={colors.textFaint} />
          </View>
        )}
        <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.name, { color: colors.text }]}>
          {inbox ? `${name}에게서` : `${name}에게`}
        </Text>
      </View>
      <PostcardEnvelope opened={opened} />
      <View style={styles.meta}>
        <Direction size={16} color={colors.textMuted} {...iconStroke} />
        <Text style={[typeScale.caption, { color: opened ? colors.textMuted : colors.accent }]}>{status}</Text>
      </View>
      <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>{formatRelative(card.createdAt)}</Text>
      <View style={styles.tags}>
        {replied ? <Tag label="답장 완료" /> : card.stampAttached && inbox ? (
          <Tag label="무료 답장" fg={colors.accent} bg={colors.accentSoft} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: NAV_CLEARANCE },
  wallet: { marginBottom: spacing.md },
  columns: { gap: spacing.sm },
  emptySlot: { flex: 1 },
  envelope: { flex: 1, minWidth: 0, borderWidth: hairline, borderRadius: 12, padding: spacing.sm, gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1 },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
