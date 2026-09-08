import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { postcardApi, walletApi } from '@/api/endpoints';
import type { PostcardView } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, Card, EmptyState, FootAction, Segmented, Tag, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { countGraphemes } from '@/lib/graphemes';
import { hairline, layout, radius, sans, spacing, typeScale, useTheme } from '@/theme';

const MAX_GRAPHEMES = 16;

type Box = 'INBOX' | 'SENT';
const BOXES: { value: Box; label: string }[] = [
  { value: 'INBOX', label: '받은 엽서' },
  { value: 'SENT', label: '보낸 엽서' },
];

/**
 * 엽서함 (§14.2) — 받은 엽서에 답장(우표 1개, 동봉 엽서는 무료)하면 서로 팔로우된다.
 * 답장하지 않아도 아무 일도 일어나지 않는다 — 거절 통보는 없다.
 */
export default function PostcardsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [box, setBox] = useState<Box>('INBOX');

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const list = useQuery({
    queryKey: ['postcards', box],
    queryFn: () => (box === 'INBOX' ? postcardApi.inbox() : postcardApi.sent()),
  });

  const items = list.data?.content ?? [];

  return (
    <PaperScreen>
      <SubHeader category="엽서함" onBack={() => router.back()} />
      <FlatList
        data={items}
        keyExtractor={(card) => String(card.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.head}>
            <Segmented options={BOXES} value={box} onChange={setBox} />
            {wallet.data ? (
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                오늘 무료 엽서 {wallet.data.freePostcardsLeftToday}장 · 보유 엽서{' '}
                {wallet.data.postcardBalance}장 · 우표 {wallet.data.stampBalance}개
              </Text>
            ) : null}
          </View>
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
    </PaperScreen>
  );
}

function PostcardRow({ card, box }: { card: PostcardView; box: Box }) {
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
            <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
              <Text style={[typeScale.label, { color: colors.accent }]}>
                {counterpartName.slice(0, 1)}
              </Text>
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
  list: { ...layout.content, paddingBottom: spacing.xxl },
  head: { gap: spacing.sm, marginBottom: spacing.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
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
