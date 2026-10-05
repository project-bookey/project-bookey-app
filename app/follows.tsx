import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from '@/navigation';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { followApi, profileApi } from '@/api/endpoints';
import type { FollowUserView } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { PaperScreen, SubHeader } from '@/components/collage';
import { EmptyState, Segmented, Tag, TextLink, formatRelative } from '@/components/ui';
import { SwipeableTabs } from '@/components/SwipeableTabs';
import { useAuth } from '@/store/auth';
import { hairline, layout, pressedStyle, spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받아오는 사람 수 — 목록 한 화면(약 12줄)보다 넉넉하게. */
const PAGE_SIZE = 20;

type Box = 'FOLLOWER' | 'FOLLOWING';
// '나' 화면 프로필 줄과 같은 순서(팔로워 → 팔로잉) — 누른 숫자와 탭 자리가 엇갈리지 않게.
const BOX_VALUES: readonly Box[] = ['FOLLOWER', 'FOLLOWING'];
const isBox = (v: unknown): v is Box => v === 'FOLLOWER' || v === 'FOLLOWING';

/**
 * 나의 팔로우 (§14.3) — 나를 팔로우하는 사람과 내가 팔로우하는 사람.
 * '나' 화면 프로필 줄의 팔로워·팔로잉 숫자를 누르면 들어온다(`?tab=` 으로 칸을 정한다).
 * 줄을 누르면 그 사람의 마이페이지로 가고, 팔로우·취소·엽서·채팅은 모두 거기서 한다.
 */
export default function FollowsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const myId = useAuth((s) => s.user?.id);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [box, setBox] = useState<Box>(isBox(params.tab) ? params.tab : 'FOLLOWER');

  // 이미 이 화면에 서 있을 때 다른 칸이 지정돼 들어오면 그 칸을 편다.
  useEffect(() => {
    if (isBox(params.tab)) setBox(params.tab);
  }, [params.tab]);

  // 칸 이름 옆 숫자 — '나' 화면과 같은 캐시 키라 거기서 왔다면 그대로 재사용된다.
  const myProfile = useQuery({
    queryKey: ['userProfile', myId],
    queryFn: () => profileApi.user(myId as number),
    enabled: myId != null,
  });

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
  const options: { value: Box; label: string }[] = [
    { value: 'FOLLOWER', label: `팔로워 ${myProfile.data?.followerCount ?? 0}` },
    { value: 'FOLLOWING', label: `팔로잉 ${myProfile.data?.followingCount ?? 0}` },
  ];

  return (
    <PaperScreen>
      <SubHeader category="팔로우" />
      <View style={styles.head}>
        <Segmented options={options} value={box} onChange={setBox} />
      </View>
      <SwipeableTabs values={BOX_VALUES} value={box} onChange={setBox}>
        <FlatList
          data={items}
          keyExtractor={(user) => String(user.userId)}
          contentContainerStyle={[styles.list, { paddingBottom: spacing.xxl + insets.bottom }]}
          ItemSeparatorComponent={() => (
            <View style={{ height: hairline, backgroundColor: colors.line }} />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
          }}
          refreshing={list.isRefetching && !list.isFetchingNextPage}
          onRefresh={() => {
            list.refetch();
            myProfile.refetch();
          }}
          renderItem={({ item }) => (
            <FollowRow user={item} onPress={() => router.push(`/user/${item.userId}`)} />
          )}
          ListEmptyComponent={
            list.isLoading ? (
              <View style={styles.status}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : list.isError ? (
              <EmptyState
                title="목록을 불러오지 못했어요"
                action={<TextLink label="다시 시도" kind="action" onPress={() => list.refetch()} />}
              />
            ) : box === 'FOLLOWING' ? (
              <EmptyState
                title="아직 팔로우한 사람이 없어요"
                description="광장에서 마음에 드는 글의 작성자 이름을 누르면, 그 사람의 페이지에서 팔로우할 수 있어요."
              />
            ) : (
              <EmptyState
                title="아직 나를 팔로우한 사람이 없어요"
                description="광장에 독후감을 올리면 나를 찾아올 거예요."
              />
            )
          }
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <View style={styles.status}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
          }
        />
      </SwipeableTabs>
    </PaperScreen>
  );
}

function FollowRow({ user, onPress }: { user: FollowUserView; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${user.nickname} 프로필 열기`}
      style={({ pressed }) => [styles.row, pressed && pressedStyle]}
    >
      <Avatar uri={user.avatarUrl} nickname={user.nickname} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>
          {user.nickname}
        </Text>
        <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
          {formatRelative(user.followedAt)}
        </Text>
      </View>
      {user.mutual ? <Tag label="맞팔로우" fg={colors.accent} bg={colors.accentSoft} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { ...layout.content, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { ...layout.content, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  status: { paddingVertical: spacing.lg, alignItems: 'center' },
});
