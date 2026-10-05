import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { postcardApi, walletApi } from '@/api/endpoints';
import type { Page, PostcardView } from '@/api/types';
import { EnvelopeIcon, NAV_CLEARANCE } from '@/components/collage';
import { PostcardWalletLine } from '@/components/social/PostcardWalletLine';
import { SwipeRow, closeOpenSwipeRow } from '@/components/SwipeRow';
import { EmptyState, TextLink, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { hairline, iconStroke, layout, pressedStyle, sans, spacing, typeScale, useTheme } from '@/theme';

import { isSealed, postcardListKey } from './postcardQueries';
import { useBlockUser } from './useBlockUser';

/** 받은·보낸 엽서를 한 번에 받아 오는 수 — 서버에 둘을 합친 목록이 없어 상자마다 이만큼 받아 섞는다. */
const PAGE_SIZE = 50;
/** 줄 왼쪽 봉투 칸 — 채팅 목록의 사진(48)과 같은 폭이라 두 목록의 글 시작선이 같다. */
const SLOT = 48;
const ENVELOPE = 30;

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
 * 엽서 구역 (§14.2) — 받은 엽서와 보낸 엽서를 한 목록에 섞는다(2026-10-05, 사용자 결정).
 * 줄은 채팅 목록과 같은 메신저형(2026-10-05 사용자 결정): 왼쪽 봉투 그림, 이름·시간 / 미리보기 한 줄.
 * 아직 열지 않은 받은 엽서는 닫힌 봉투에 본문을 가리고, 연 엽서는 열린 봉투, 보낸 엽서는 종이비행기다.
 * 줄을 누르면 엽서 화면(/postcard/[id])에서 열고 답장한다. 줄을 밀면 차단·삭제 — 같은 동작이 엽서 화면에도 있다.
 * 답장(우표 1개, 동봉 엽서는 무료)이 오가면 두 사람 사이에 채팅이 열린다 — 채팅은 헤더 왼쪽 말풍선에서 연다.
 */
export function PostcardList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // 당겨서 새로고침 표시는 손으로 당긴 때만 — 다른 화면의 무효화로 다시 받을 때는 돌지 않게 따로 쥔다.
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, arm, disarm } = useDeleteConfirm<number>();
  const { confirmBlock } = useBlockUser();
  const { colors } = useTheme();

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const list = useQuery({
    queryKey: postcardListKey,
    queryFn: async () => {
      const [inbox, sent] = await Promise.all([
        postcardApi.inbox(0, PAGE_SIZE),
        postcardApi.sent(0, PAGE_SIZE),
      ]);
      return mergePostcards(inbox, sent);
    },
  });
  const remove = useMutation({
    mutationFn: (postcardId: number) => postcardApi.remove(postcardId),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['postcards'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '엽서를 삭제하지 못했어요.'),
  });

  const items = list.data ?? [];
  const pull = async () => {
    setPulling(true);
    await Promise.all([list.refetch(), wallet.refetch()]);
    setPulling(false);
  };
  const pressDelete = (postcardId: number) => {
    if (confirm === postcardId) {
      disarm();
      remove.mutate(postcardId);
      return;
    }
    arm(postcardId);
  };
  const pressBlock = async (card: PostcardView) => {
    const counterpart = card.mine
      ? { id: card.toUserId, name: card.toNickname }
      : { id: card.fromUserId, name: card.fromNickname };
    // 차단을 취소하면 밀어 둔 줄을 닫는다(막으면 줄이 목록에서 빠진다).
    const blocked = await confirmBlock(counterpart.id, counterpart.name);
    if (!blocked) closeOpenSwipeRow();
  };

  return (
    <FlatList
      data={items}
      // '삭제' → '한 번 더' 처럼 줄 밖 상태로 바뀌는 단추가 있어 그 값이 바뀌면 줄을 다시 그린다.
      extraData={confirm}
      keyExtractor={(card) => String(card.id)}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} />}
      // 구분선은 글 시작선에서 — 봉투 옆은 비워 줄이 묶여 보이게 한다.
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: colors.line }]} />
      )}
      ListHeaderComponent={
        <View style={styles.head}>
          {wallet.data ? (
            <PostcardWalletLine
              freeToday={wallet.data.freePostcardsLeftToday}
              postcards={wallet.data.postcardBalance}
              stamps={wallet.data.stampBalance}
            />
          ) : null}
          {error ? (
            <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <SwipeRow
          onClose={() => { if (confirm === item.id) disarm(); }}
          actions={[
            {
              key: 'block',
              label: '차단',
              icon: 'block',
              tone: 'neutral',
              onPress: () => void pressBlock(item),
              accessibilityLabel: `${item.mine ? item.toNickname : item.fromNickname}님 차단`,
            },
            {
              key: 'delete',
              label: confirm === item.id ? '한 번 더' : '삭제',
              icon: 'trash',
              tone: 'danger',
              onPress: () => pressDelete(item.id),
              accessibilityLabel: confirm === item.id ? '엽서 삭제 확인' : '엽서 삭제',
            },
          ]}
        >
          <PostcardRow
            card={item}
            onOpen={() => router.push({ pathname: '/postcard/[id]', params: { id: String(item.id) } })}
            onBlock={() => void pressBlock(item)}
            onDelete={() => pressDelete(item.id)}
          />
        </SwipeRow>
      )}
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
  );
}

function PostcardRow({ card, onOpen, onBlock, onDelete }: {
  card: PostcardView;
  onOpen: () => void;
  onBlock: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  // mine = 내가 보낸 엽서(서버가 보낸 사람으로 정한다).
  const inbox = !card.mine;
  const sealed = isSealed(card);
  const name = inbox ? card.fromNickname : card.toNickname;
  const replied = card.status === 'REPLIED';
  const label = [
    inbox ? `${name}에게서 온 엽서` : `${name}에게 보낸 엽서`,
    sealed ? '아직 열지 않음' : card.body,
    replied ? '답장 완료' : null,
  ].filter(Boolean).join(', ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={label}
      // 스크린 리더는 밀기 대신 동작 메뉴로 차단·삭제한다.
      accessibilityActions={[{ name: 'block', label: '차단' }, { name: 'delete', label: '삭제' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'block') onBlock();
        if (event.nativeEvent.actionName === 'delete') onDelete();
      }}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.bg }, pressed ? pressedStyle : null]}
    >
      {/* 받은 엽서는 봉투(닫힘·열림), 보낸 엽서는 종이비행기 — 방향은 옆 '…에게서 / …에게' 글자로도 읽힌다. */}
      <View style={styles.slot}>
        {inbox ? (
          <EnvelopeIcon state={sealed ? 'sealed' : 'open'} size={ENVELOPE} color={sealed ? colors.text : colors.textMuted} />
        ) : (
          <Send size={ENVELOPE - 4} color={colors.textMuted} {...iconStroke} aria-hidden />
        )}
      </View>
      <View style={styles.main}>
        <View style={styles.line}>
          <Text
            numberOfLines={1}
            style={[sealed ? typeScale.bodyStrong : styles.nameRead, styles.grow, { color: colors.text }]}
          >
            {inbox ? `${name}에게서` : `${name}에게`}
          </Text>
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>{formatRelative(card.createdAt)}</Text>
        </View>
        <View style={styles.line}>
          {/* 열지 않은 엽서는 본문을 가린다 — 봉투를 열어야 읽는다. */}
          <Text
            numberOfLines={1}
            style={[typeScale.caption, styles.grow, { color: sealed ? colors.text : colors.textFaint }]}
          >
            {sealed ? '아직 열지 않은 엽서' : card.body}
          </Text>
          {replied ? (
            <Text style={[typeScale.monoLabel, { color: colors.textMuted }]}>답장 완료</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 줄이 화면 끝까지 닿아야 밀었을 때 단추가 가장자리에서 나온다 — 좌우 여백은 줄 안에 둔다.
  list: { ...layout.content, paddingTop: spacing.lg, paddingBottom: NAV_CLEARANCE },
  head: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  slot: { width: SLOT, height: SLOT, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minWidth: 0, gap: spacing.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  // 연 엽서의 이름은 한 단 가볍게 — 굵은 이름은 아직 열지 않은 엽서에만 남긴다.
  nameRead: { ...typeScale.bodyStrong, fontFamily: sans.regular },
  separator: { height: hairline, marginLeft: spacing.lg + SLOT + spacing.md },
});
