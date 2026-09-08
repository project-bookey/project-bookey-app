import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { chatApi } from '@/api/endpoints';
import { EmptyState, formatRelative } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

/** 하단 구역 탭(SectionNav)이 목록 위에 떠 있어 그만큼 아래를 비운다 — 서가 홈과 같은 값. */
const NAV_CLEARANCE = 104;

/**
 * 채팅 목록 (§14.3) — 맞팔로우끼리만. 마지막 메시지 최신순, 15초마다 갱신.
 * 메신저 구역(app/(tabs)/messenger.tsx)의 '채팅' 칸이다 — 헤더·칸 전환은 구역 화면이 그린다.
 */
export function ChatList() {
  const router = useRouter();
  const { colors } = useTheme();
  const list = useQuery({
    queryKey: ['chats'],
    queryFn: () => chatApi.list(),
    refetchInterval: 15_000,
  });

  const items = list.data?.content ?? [];

  return (
    <FlatList
      data={items}
      keyExtractor={(chat) => String(chat.id)}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => (
        <View style={{ height: hairline, backgroundColor: colors.line }} />
      )}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({
            pathname: '/chat/[id]',
            params: { id: String(item.id), name: item.otherNickname },
          })}
          accessibilityRole="button"
          style={styles.row}
        >
          {item.otherAvatarUrl ? (
            <Image source={{ uri: item.otherAvatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
              <Text style={[typeScale.label, { color: colors.accent }]}>
                {item.otherNickname.slice(0, 1)}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
              {item.otherNickname}
            </Text>
            <Text
              style={[typeScale.caption, {
                color: item.unreadCount > 0 ? colors.text : colors.textFaint,
              }]}
              numberOfLines={1}
            >
              {item.lastMessageBody ?? '엽서로 연결됐어요 — 첫 인사를 건네보세요'}
            </Text>
          </View>
          <View style={styles.meta}>
            <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
              {formatRelative(item.lastMessageAt ?? item.createdAt)}
            </Text>
            {item.unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Text style={[typeScale.monoLabel, { color: colors.onAccent }]}>
                  {item.unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
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

const styles = StyleSheet.create({
  // 좌우 여백은 다른 구역 목록(모임)과 같은 lg — 위 칸 전환 버튼과 가장자리를 맞춘다.
  list: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: NAV_CLEARANCE },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
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
