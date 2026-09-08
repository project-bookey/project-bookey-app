import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { postcardApi, walletApi } from '@/api/endpoints';
import type { PostcardView } from '@/api/types';
import { AVATAR_SIZE, PersonGlyph } from '@/components/quote/QuoteCard';
import { Button, Card, EmptyState, FootAction, Tag, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { countGraphemes } from '@/lib/graphemes';
import { hairline, layout, radius, sans, spacing, typeScale, useTheme } from '@/theme';

const MAX_GRAPHEMES = 16;

/** 하단 구역 탭(SectionNav)이 목록 위에 떠 있어 그만큼 아래를 비운다 — 서가 홈과 같은 값. */
const NAV_CLEARANCE = 104;

export type PostcardBox = 'INBOX' | 'SENT';

/**
 * 엽서함 (§14.2) — 받은 엽서에 답장(우표 1개, 동봉 엽서는 무료)하면 서로 팔로우된다.
 * 답장하지 않아도 아무 일도 일어나지 않는다 — 거절 통보는 없다.
 *
 * 메신저 구역(app/(tabs)/messenger.tsx)의 '받은 엽서'·'보낸 엽서' 칸이다 — 어느 칸인지는
 * 구역 화면의 칸 전환이 정하고 여기는 그 상자 하나만 그린다.
 */
export function PostcardList({ box }: { box: PostcardBox }) {
  const { colors } = useTheme();

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const list = useQuery({
    queryKey: ['postcards', box],
    queryFn: () => (box === 'INBOX' ? postcardApi.inbox() : postcardApi.sent()),
  });

  const items = list.data?.content ?? [];

  return (
    <FlatList
      data={items}
      keyExtractor={(card) => String(card.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        wallet.data ? (
          <Text style={[typeScale.caption, styles.wallet, { color: colors.textFaint }]}>
            오늘 무료 엽서 {wallet.data.freePostcardsLeftToday}장 · 보유 엽서{' '}
            {wallet.data.postcardBalance}장 · 우표 {wallet.data.stampBalance}개
          </Text>
        ) : null
      }
      renderItem={({ item }) => <PostcardRow card={item} box={box} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={
        list.isLoading ? null : box === 'INBOX' ? (
          <EmptyState
            title="아직 받은 엽서가 없어요"
            description="피드에 독후감을 올리면 엽서가 도착할 거예요."
          />
        ) : (
          <EmptyState
            title="아직 보낸 엽서가 없어요"
            description="피드에서 마음에 드는 독후감에 엽서를 보내보세요."
          />
        )
      }
    />
  );
}

function PostcardRow({ card, box }: { card: PostcardView; box: PostcardBox }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { confirm, arm, disarm } = useDeleteConfirm<number>();
  const confirmingDelete = confirm === card.id;

  const inbox = box === 'INBOX';
  const counterpartName = inbox ? card.fromNickname : card.toNickname;
  const counterpartAvatar = inbox ? card.fromAvatarUrl : card.toAvatarUrl;
  const counterpartId = inbox ? card.fromUserId : card.toUserId;
  const replied = card.status === 'REPLIED';
  const used = countGraphemes(body);
  const over = used > MAX_GRAPHEMES;

  const reply = useMutation({
    mutationFn: () => postcardApi.reply(card.id, body.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postcards'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '답장을 보내지 못했어요.'),
  });

  const remove = useMutation({
    mutationFn: () => postcardApi.remove(card.id),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['postcards'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '엽서를 삭제하지 못했어요.'),
  });

  const pressDelete = () => {
    if (confirmingDelete) {
      disarm();
      remove.mutate();
      return;
    }
    arm(card.id);
  };

  return (
    <Card>
      <View style={styles.rowHead}>
        <Pressable
          onPress={replied ? () => router.push(`/user/${counterpartId}`) : undefined}
          accessibilityRole={replied ? 'button' : undefined}
          style={styles.person}
        >
          {counterpartAvatar ? (
            <Image source={{ uri: counterpartAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}>
              <PersonGlyph size={AVATAR_SIZE} color={colors.textFaint} />
            </View>
          )}
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
            {inbox ? `${counterpartName}에게서` : `${counterpartName}에게`}
          </Text>
        </Pressable>
        <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
          {formatRelative(card.createdAt)}
        </Text>
      </View>

      {card.postTitle ? (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          『{card.postTitle}』 독후감을 보고
        </Text>
      ) : null}

      <Text style={[styles.body, { color: colors.text }]}>{card.body}</Text>

      <View style={styles.tagRow}>
        {card.stampAttached ? <Tag label="우표 동봉 — 무료 답장" fg={colors.accent} bg={colors.accentSoft} /> : null}
        {replied ? <Tag label="답장 완료 · 맞팔로우" /> : null}
      </View>

      {replied && card.replyBody ? (
        <View style={[styles.replyBox, { borderColor: colors.line }]}>
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>답장</Text>
          <Text style={[styles.body, { color: colors.text }]}>{card.replyBody}</Text>
        </View>
      ) : null}

      {inbox && !replied ? (
        replying ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <TextInput
              style={[styles.input, {
                borderColor: over ? colors.danger : colors.lineStrong,
                backgroundColor: colors.surface,
                color: colors.text,
              }]}
              value={body}
              onChangeText={(next) => { setBody(next); setError(null); }}
              placeholder="답장도 딱 16글자"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="답장 본문"
            />
            <Text style={[typeScale.monoLabel, styles.counter, {
              color: over ? colors.danger : colors.textFaint,
            }]}>
              {used} / {MAX_GRAPHEMES}
            </Text>
            {error ? (
              <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button label="취소" variant="ghost" size="sm" onPress={() => setReplying(false)} />
              <Button
                label={card.stampAttached ? '무료로 답장' : '우표 1개로 답장'}
                size="sm"
                onPress={() => reply.mutate()}
                loading={reply.isPending}
                disabled={over || body.trim().length === 0}
              />
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <Button
              label={card.stampAttached ? '무료로 답장하기' : '답장하기 (우표 1개)'}
              size="sm"
              onPress={() => setReplying(true)}
            />
          </View>
        )
      ) : null}
      <View style={styles.deleteRow}>
        <FootAction
          label={confirmingDelete ? '한 번 더' : '삭제'}
          onPress={pressDelete}
          tone={confirmingDelete ? 'danger' : 'faint'}
          accessibilityLabel={confirmingDelete ? '엽서 삭제 확인' : '엽서 삭제'}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // 좌우 여백은 다른 구역 목록(모임)과 같은 lg — 위 칸 전환 버튼과 가장자리를 맞춘다.
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: NAV_CLEARANCE },
  wallet: { marginBottom: spacing.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // 아바타는 앱 공통 크기(광장 카드·홈 '오늘의 글'과 같은 AVATAR_SIZE) — 여기서만 작으면 다른 사람처럼 보인다.
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  body: { ...typeScale.quote, marginTop: spacing.sm },
  tagRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  replyBox: {
    borderWidth: hairline, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm, gap: 2,
  },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
    fontFamily: sans.regular,
    fontSize: 15,
  },
  counter: { alignSelf: 'flex-end' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  deleteRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm },
});
