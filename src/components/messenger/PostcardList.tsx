import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Mail, Send } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { postcardApi, walletApi } from '@/api/endpoints';
import type { Page, PostcardView } from '@/api/types';
import { AVATAR_SIZE, PersonGlyph } from '@/components/Avatar';
import { NAV_CLEARANCE } from '@/components/collage';
import { KeyboardArea, KeyboardRevealProvider, useKeyboardReveal } from '@/components/keyboard';
import { PostcardWalletLine } from '@/components/social/PostcardWalletLine';
import { Button, Card, DeleteAction, EmptyState, Tag, TextLink, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { countGraphemes } from '@/lib/graphemes';
import { hairline, iconStroke, layout, radius, sans, spacing, typeScale, useTheme } from '@/theme';

const MAX_GRAPHEMES = 16;
/** 받은·보낸 엽서를 한 번에 받아 오는 수 — 서버에 둘을 합친 목록이 없어 상자마다 이만큼 받아 섞는다. */
const PAGE_SIZE = 50;

/**
 * 받은 엽서와 보낸 엽서를 한 줄로 섞는다 — 최신순(같은 시각이면 id 큰 것 먼저).
 * 한쪽에 다음 쪽이 남아 있으면, 그쪽에서 받은 가장 오래된 엽서보다 오래된 것은 뺀다 — 그 사이에 안 받은
 * 엽서가 끼어 있을 수 있어서, 남기면 순서가 틀린다.
 */
export function mergePostcards(inbox: Page<PostcardView>, sent: Page<PostcardView>): PostcardView[] {
  const time = (card: PostcardView) => Date.parse(card.createdAt);
  const cutoff = Math.max(
    ...[inbox, sent]
      .filter((page) => page.hasNext && page.content.length > 0)
      .map((page) => Math.min(...page.content.map(time))),
    -Infinity,
  );
  return [...inbox.content, ...sent.content]
    .filter((card) => time(card) >= cutoff)
    .sort((a, b) => time(b) - time(a) || b.id - a.id);
}

/**
 * 엽서 구역 (§14.2) — 받은 엽서와 보낸 엽서를 한 목록에 섞고, 카드마다 봉투(받은)·종이비행기(보낸)로 가른다
 * (2026-10-05, 사용자 결정). 받은 엽서에 답장(우표 1개, 동봉 엽서는 무료)하면 두 사람 사이에 채팅이 열린다 —
 * 채팅은 헤더 왼쪽 말풍선에서 연다. 답장하지 않아도 아무 일도 일어나지 않는다 — 거절 통보는 없다.
 */
export function PostcardList() {
  const { colors } = useTheme();
  // 당겨서 새로고침 표시는 손으로 당긴 때만 — 다른 화면의 무효화로 다시 받을 때는 돌지 않게 따로 쥔다.
  const [pulling, setPulling] = useState(false);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const list = useQuery({
    queryKey: ['postcards', 'ALL'],
    queryFn: async () => {
      const [inbox, sent] = await Promise.all([
        postcardApi.inbox(0, PAGE_SIZE),
        postcardApi.sent(0, PAGE_SIZE),
      ]);
      return mergePostcards(inbox, sent);
    },
  });

  const items = list.data ?? [];
  const pull = async () => {
    setPulling(true);
    await Promise.all([list.refetch(), wallet.refetch()]);
    setPulling(false);
  };
  // 답장 칸을 누르면 그 밑 보내기 버튼까지 키보드 위로 올린다. FlatList 의 getScrollResponder() 는 실제로는
  // 안쪽 ScrollView 를 돌려준다(타입 선언만 어긋나 있다).
  const listRef = useRef<FlatList<PostcardView>>(null);
  const getScroll = useCallback(() => listRef.current?.getScrollResponder() as unknown as ScrollView | null, []);

  return (
    <KeyboardArea>
      <KeyboardRevealProvider getScroll={getScroll}>
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(card) => String(card.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} />}
          ListHeaderComponent={
            wallet.data ? (
              <View style={styles.wallet}>
                <PostcardWalletLine
                  freeToday={wallet.data.freePostcardsLeftToday}
                  postcards={wallet.data.postcardBalance}
                  stamps={wallet.data.stampBalance}
                />
              </View>
            ) : null
          }
          renderItem={({ item }) => <PostcardRow card={item} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            list.isLoading ? null : list.isError ? (
              <EmptyState
                title="엽서를 불러오지 못했어요"
                action={<TextLink label="다시 시도" kind="action" onPress={() => list.refetch()} />}
              />
            ) : (
              <EmptyState
                title="아직 주고받은 엽서가 없어요"
                description="광장에서 마음에 드는 독후감에 엽서를 보내 보세요."
              />
            )
          }
        />
      </KeyboardRevealProvider>
    </KeyboardArea>
  );
}

function PostcardRow({ card }: { card: PostcardView }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState('');
  const reveal = useKeyboardReveal();
  const replyActionsRef = useRef<View>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, arm, disarm } = useDeleteConfirm<number>();
  const confirmingDelete = confirm === card.id;

  // mine = 내가 보낸 엽서(서버가 보낸 사람으로 정한다).
  const inbox = !card.mine;
  const counterpartName = inbox ? card.fromNickname : card.toNickname;
  const counterpartAvatar = inbox ? card.fromAvatarUrl : card.toAvatarUrl;
  const counterpartId = inbox ? card.fromUserId : card.toUserId;
  const DirectionIcon = inbox ? Mail : Send;
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
          {/* 받은 엽서는 봉투, 보낸 엽서는 종이비행기 — 방향은 옆 '…에게서 / …에게' 글자로도 읽힌다. */}
          <DirectionIcon
            size={DIRECTION_ICON}
            color={colors.textMuted}
            {...iconStroke}
            style={styles.directionIcon}
            aria-hidden
          />
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.personName, { color: colors.text }]}>
            {inbox ? `${counterpartName}에게서` : `${counterpartName}에게`}
          </Text>
        </Pressable>
        {/* 삭제는 시간 옆 머리글로 — 카드 아래 답장 버튼과 떨어뜨려 파괴적 동작을 오터치하지 않게 한다. */}
        <View style={styles.headMeta}>
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
            {formatRelative(card.createdAt)}
          </Text>
          <DeleteAction target="엽서" confirming={confirmingDelete} onPress={pressDelete} />
        </View>
      </View>

      {card.postTitle ? (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          『{card.postTitle}』 독후감을 보고
        </Text>
      ) : null}

      <Text style={[styles.body, { color: colors.text }]}>{card.body}</Text>

      <View style={styles.tagRow}>
        {card.stampAttached ? <Tag label="우표 동봉 — 무료 답장" fg={colors.accent} bg={colors.accentSoft} /> : null}
        {replied ? <Tag label="답장 완료" /> : null}
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
              placeholder="답장도 16글자까지"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="답장 본문"
              onFocus={() => reveal(replyActionsRef)}
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
            <View ref={replyActionsRef} style={styles.actions}>
              <Button label="취소" variant="outline" size="sm" onPress={() => setReplying(false)} />
              <Button
                label={card.stampAttached ? '무료로 보내기' : '우표 1개로 보내기'}
                size="sm"
                onPress={() => reply.mutate()}
                loading={reply.isPending}
                disabled={over || body.trim().length === 0}
              />
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            {/* 받은 엽서마다 붙는 버튼이라 outline — primary 는 열린 답장 칸의 보내기 하나뿐이다. */}
            <Button
              label="답장 쓰기"
              variant="outline"
              size="sm"
              onPress={() => setReplying(true)}
            />
          </View>
        )
      ) : null}
    </Card>
  );
}

/** 받은·보낸 표시 아이콘 크기 — 이름(15px) 옆에서 글자 높이와 맞는 16(2026-10-05 시안 ①). */
const DIRECTION_ICON = 16;

const styles = StyleSheet.create({
  // 좌우 여백은 다른 구역 목록(클럽)과 같은 lg, 위는 헤더와 첫 줄 사이를 띄운다.
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: NAV_CLEARANCE },
  wallet: { marginBottom: spacing.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  // 긴 닉네임은 말줄임 — 오른쪽 시간·삭제를 밀어내지 않는다.
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  personName: { flexShrink: 1 },
  // 긴 닉네임이 말줄임될 때 아이콘까지 눌려 작아지지 않게.
  directionIcon: { flexShrink: 0 },
  headMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // 아바타는 앱 공통 크기(광장 카드·홈 '오늘의 글'과 같은 AVATAR_SIZE) — 여기서만 작으면 다른 사람처럼 보인다.
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  body: { ...typeScale.quote, marginTop: spacing.sm },
  tagRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  // 엽서에 적힌 답장 — 종이 위 글이라 앱 카드(md)보다 각진 예전 모서리(4)를 지킨다.
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
});
