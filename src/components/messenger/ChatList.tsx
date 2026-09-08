import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { chatApi } from '@/api/endpoints';
import type { ChatSummary } from '@/api/types';
import { EmptyState, FootAction, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

/** 하단 구역 탭(SectionNav)이 목록 위에 떠 있어 그만큼 아래를 비운다 — 서가 홈과 같은 값. */
const NAV_CLEARANCE = 104;

/**
 * 채팅 목록 (§14.3) — 맞팔로우끼리만. 마지막 메시지 최신순, 15초마다 갱신.
 * 메신저 구역(app/(tabs)/messenger.tsx)의 '채팅' 칸이다 — 헤더·칸 전환은 구역 화면이 그린다.
 */
export function ChatList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const { confirm, arm, disarm } = useDeleteConfirm<number>();
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

  return (
    <FlatList
      data={items}
      keyExtractor={(chat) => String(chat.id)}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => (
        <View style={{ height: hairline, backgroundColor: colors.line }} />
      )}
      ListHeaderComponent={error ? (
        <Text style={[typeScale.caption, styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      renderItem={({ item }) => (
        <ChatRow
          chat={item}
          confirming={confirm === item.id}
          onOpen={() => router.push({
            pathname: '/chat/[id]',
            params: { id: String(item.id), name: item.otherNickname },
          })}
          onDelete={() => pressDelete(item.id)}
        />
      )}
      ListEmptyComponent={
        list.isLoading ? null : (
          <EmptyState
            title="아직 채팅이 없어요"
            description="엽서에 답장이 오가면 서로 팔로우되고, 그때 채팅이 열립니다."
          />
        )
      }
    />
  );
}

function ChatRow({ chat, confirming, onOpen, onDelete }: {
  chat: ChatSummary;
  confirming: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <Pressable onPress={onOpen} accessibilityRole="button" style={styles.rowMain}>
        {chat.otherAvatarUrl ? (
          <Image source={{ uri: chat.otherAvatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
            <Text style={[typeScale.label, { color: colors.accent }]}>
              {chat.otherNickname.slice(0, 1)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
            {chat.otherNickname}
          </Text>
          <Text
            style={[typeScale.caption, {
              color: chat.unreadCount > 0 ? colors.text : colors.textFaint,
            }]}
            numberOfLines={1}
          >
            {chat.lastMessageBody ?? '엽서로 연결됐어요 — 첫 인사를 건네보세요'}
          </Text>
        </View>
      </Pressable>
      <View style={styles.meta}>
        <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
          {formatRelative(chat.lastMessageAt ?? chat.createdAt)}
        </Text>
        {chat.unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={[typeScale.monoLabel, { color: colors.onAccent }]}>
              {chat.unreadCount}
            </Text>
          </View>
        ) : null}
        <FootAction
          label={confirming ? '한 번 더' : '삭제'}
          onPress={onDelete}
          tone={confirming ? 'danger' : 'faint'}
          accessibilityLabel={confirming ? '채팅 삭제 확인' : '채팅 삭제'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 좌우 여백은 다른 구역 목록(모임)과 같은 lg — 위 칸 전환 버튼과 가장자리를 맞춘다.
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: NAV_CLEARANCE },
  error: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  meta: { alignItems: 'flex-end', gap: spacing.xs },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
});
