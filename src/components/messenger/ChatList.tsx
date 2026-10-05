import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/navigation';
import { useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { chatApi } from '@/api/endpoints';
import type { ChatSummary } from '@/api/types';
import { chatMessagePreview } from '@/components/chat/bookeyStickers';
import { PersonGlyph } from '@/components/Avatar';
import { SwipeRow, closeOpenSwipeRow } from '@/components/SwipeRow';
import { EmptyState, TextLink, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { hairline, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

import { useBlockUser } from './useBlockUser';

/** 채팅 상대 사진 지름(px) — 목록 행이 커서 작성자 아바타(AVATAR_SIZE)보다 한 단 크다. */
const AVATAR = 48;

/**
 * 채팅 목록 (§14.3) — 엽서 답장이 오간 사이만. 마지막 메시지 최신순, 15초마다 갱신.
 * 채팅 화면(app/chats.tsx)이 머리 아래에 그린다. 쿼리는 헤더 말풍선의 안 읽은 표시와 같은 키(['chats'])다.
 *
 * 줄 모양은 메신저 표준(2026-10-05 시안 A): 이름 줄 끝에 시간, 미리보기 줄 끝에 안 읽은 수.
 * 줄마다 서 있던 '삭제' 버튼은 빼고, 줄을 왼쪽으로 밀면 '차단'·'삭제'가 나온다(사용자 결정, 단추는 SwipeRow 시안 D).
 * 같은 동작은 채팅방 머리의 ⋯ 메뉴에도 있다 — 제스처만으로 할 수 있는 기능을 두지 않는다.
 */
export function ChatList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  // 당겨서 새로고침 표시는 손으로 당긴 때만 — 15초마다 도는 갱신에 매번 돌지 않게 따로 쥔다.
  const [pulling, setPulling] = useState(false);
  const { confirm, arm, disarm } = useDeleteConfirm<number>();
  const { confirmBlock } = useBlockUser();

  const list = useQuery({
    queryKey: ['chats'],
    queryFn: () => chatApi.list(),
    refetchInterval: 15_000,
  });
  const remove = useMutation({
    mutationFn: (chatId: number) => chatApi.remove(chatId),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '채팅을 삭제하지 못했어요.'),
  });

  const items = list.data?.content ?? [];
  const pressDelete = (chatId: number) => {
    if (confirm === chatId) {
      disarm();
      remove.mutate(chatId);
      return;
    }
    arm(chatId);
  };
  const pressBlock = async (chat: ChatSummary) => {
    // 차단을 취소하면 밀어 둔 줄을 닫는다(막으면 줄이 목록에서 빠진다).
    const blocked = await confirmBlock(chat.otherUserId, chat.otherNickname);
    if (!blocked) closeOpenSwipeRow();
  };
  const pull = async () => {
    setPulling(true);
    await list.refetch();
    setPulling(false);
  };

  return (
    <FlatList
      data={items}
      // '삭제' → '한 번 더' 처럼 줄 밖 상태로 바뀌는 단추가 있어 그 값이 바뀌면 줄을 다시 그린다.
      extraData={confirm}
      keyExtractor={(chat) => String(chat.id)}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} />}
      // 구분선은 글 시작선에서 — 사진 옆은 비워 줄이 묶여 보이게 한다.
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: colors.line }]} />
      )}
      ListHeaderComponent={error ? (
        <Text style={[typeScale.caption, styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
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
              accessibilityLabel: `${item.otherNickname}님 차단`,
            },
            {
              key: 'delete',
              label: confirm === item.id ? '한 번 더' : '삭제',
              icon: 'trash',
              tone: 'danger',
              onPress: () => pressDelete(item.id),
              accessibilityLabel: confirm === item.id ? '채팅 삭제 확인' : '채팅 삭제',
            },
          ]}
        >
          <ChatRow
            chat={item}
            onOpen={() => router.push({
              pathname: '/chat/[id]',
              params: {
                id: String(item.id),
                name: item.otherNickname,
                userId: String(item.otherUserId),
                ...(item.otherAvatarUrl ? { avatar: item.otherAvatarUrl } : null),
              },
            })}
            onBlock={() => void pressBlock(item)}
            onDelete={() => pressDelete(item.id)}
          />
        </SwipeRow>
      )}
      ListEmptyComponent={
        list.isLoading ? null : list.isError ? (
          <EmptyState
            title="채팅을 불러오지 못했어요"
            action={<TextLink label="다시 시도" kind="action" onPress={() => list.refetch()} />}
          />
        ) : (
          <EmptyState
            illustration
            title="아직 채팅이 없어요"
            description="엽서와 답장을 주고받으면 그 사람과 채팅할 수 있어요."
          />
        )
      }
    />
  );
}

function ChatRow({ chat, onOpen, onBlock, onDelete }: {
  chat: ChatSummary;
  onOpen: () => void;
  onBlock: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const unread = chat.unreadCount > 0;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={unread
        ? `${chat.otherNickname}, 안 읽은 메시지 ${chat.unreadCount}개`
        : chat.otherNickname}
      // 스크린 리더는 밀기 대신 동작 메뉴로 차단·삭제한다.
      accessibilityActions={[{ name: 'block', label: '차단' }, { name: 'delete', label: '삭제' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'block') onBlock();
        if (event.nativeEvent.actionName === 'delete') onDelete();
      }}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.bg }, pressed ? pressedStyle : null]}
    >
      {chat.otherAvatarUrl ? (
        <Image source={{ uri: chat.otherAvatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}>
          <PersonGlyph size={AVATAR} color={colors.textFaint} />
        </View>
      )}
      <View style={styles.main}>
        <View style={styles.line}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.grow, { color: colors.text }]}>
            {chat.otherNickname}
          </Text>
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
            {formatRelative(chat.lastMessageAt ?? chat.createdAt)}
          </Text>
        </View>
        <View style={styles.line}>
          <Text
            numberOfLines={1}
            style={[typeScale.caption, styles.grow, { color: unread ? colors.text : colors.textFaint }]}
          >
            {chat.lastMessageBody
              ? chatMessagePreview(chat.lastMessageBody)
              : '엽서로 연결됐어요. 첫 인사를 건네 보세요'}
          </Text>
          {unread ? (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={[typeScale.monoLabel, { color: colors.onAccent }]}>
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 줄이 화면 끝까지 닿아야 밀었을 때 단추가 가장자리에서 나온다 — 좌우 여백은 줄 안에 둔다.
  list: { ...layout.content, paddingTop: spacing.sm },
  error: { marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  avatar: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  main: { flex: 1, minWidth: 0, gap: spacing.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  badge: {
    minWidth: 20, height: 20, borderRadius: radius.sm, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  separator: { height: hairline, marginLeft: spacing.lg + AVATAR + spacing.md },
});
