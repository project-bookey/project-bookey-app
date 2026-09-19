import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { followApi } from '@/api/endpoints';
import type { FollowUserView } from '@/api/types';
import { PaperScreen, SubHeader } from '@/components/collage';
import { EmptyState, Segmented, Tag, formatRelative } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받아오는 사람 수 — 목록 한 화면(약 12줄)보다 넉넉하게. */
const PAGE_SIZE = 20;

type Box = 'FOLLOWING' | 'FOLLOWER';
const BOXES: { value: Box; label: string }[] = [
  { value: 'FOLLOWING', label: '팔로잉' },
  { value: 'FOLLOWER', label: '팔로워' },
];

/**
 * 팔로우 목록 (§14.3) — 검색이 없으므로 사람에게 닿는 길은 피드·엽서·이 목록뿐이다.
 * 누르면 그 사람의 마이페이지로 가고, 엽서·채팅은 거기서 건다(맞팔로우만 채팅).
 */
export default function FollowsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [box, setBox] = useState<Box>(tab === 'FOLLOWER' ? 'FOLLOWER' : 'FOLLOWING');

  const list = useInfiniteQuery({
    queryKey: ['follows', box],
    queryFn: ({ pageParam }) => (box === 'FOLLOWING'
      ? followApi.following(pageParam, PAGE_SIZE)
      : followApi.followers(pageParam, PAGE_SIZE)),
    initialPageParam: 0,
    // 서버가 page 를 생략해도 이미 받은 페이지 수로 다음 번호를 셀 수 있다(PostFeed 와 같은 셈).
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  const items = list.data?.pages.flatMap((page) => page.content ?? []) ?? [];

  return (
    <PaperScreen>
      <SubHeader category="팔로우" onBack={() => router.back()} />
      <FlatList
        data={items}
        keyExtractor={(user) => String(user.userId)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.head}>
            <Segmented options={BOXES} value={box} onChange={setBox} />
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: hairline, backgroundColor: colors.line }} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
        }}
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        onRefresh={() => list.refetch()}
        renderItem={({ item }) => <FollowRow user={item} />}
        ListEmptyComponent={
          list.isLoading ? null : list.isError ? (
            <EmptyState
              title="목록을 불러오지 못했어요"
              description="잠시 후 다시 시도해 주세요."
            />
          ) : box === 'FOLLOWING' ? (
            <EmptyState
              title="아직 팔로우한 사람이 없어요"
              description="피드에서 마음에 드는 독후감의 작성자에게 엽서를 보내보세요."
            />
          ) : (
            <EmptyState
              title="아직 나를 팔로우한 사람이 없어요"
              description="피드에 독후감을 올리면 엽서가 도착할 거예요."
            />
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : null
        }
      />
    </PaperScreen>
  );
}

function FollowRow({ user }: { user: FollowUserView }) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => router.push(`/user/${user.userId}`)}
      accessibilityRole="button"
      accessibilityLabel={`${user.nickname} 프로필 열기`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
    >
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
          <Text style={[typeScale.label, { color: colors.accent }]}>
            {user.nickname.slice(0, 1)}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>
          {user.nickname}
        </Text>
        <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
          {formatRelative(user.followedAt)}
        </Text>
      </View>
      {/* 맞팔로우에게만 채팅을 걸 수 있다 — 어느 줄이 그런지 여기서 미리 알려준다(§14.3). */}
      {user.mutual ? <Tag label="맞팔로우" fg={colors.accent} bg={colors.accentSoft} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: spacing.xxl },
  head: { gap: spacing.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
});
