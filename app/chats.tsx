import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { chatApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { EmptyState, formatRelative } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

/** 채팅 목록 (§14.3) — 맞팔로우끼리만. 목록은 마지막 메시지 최신순, 15초마다 갱신. */
export default function ChatsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const list = useQuery({
    queryKey: ['chats'],
    queryFn: () => chatApi.list(),
    refetchInterval: 15_000,
  });

  const items = list.data?.content ?? [];

  return (
    <PaperScreen>
      <SubHeader category="채팅" onBack={() => router.back()} />
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
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: spacing.xxl },
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
