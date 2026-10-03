import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { followApi, profileApi } from '@/api/endpoints';
import type { FollowUserView } from '@/api/types';
import { Card, EmptyState, Eyebrow, Rule, Segmented, Tag, formatRelative, linkLabel } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/** 한 번에 받아오는 사람 수 — '나' 화면 안에 펼치므로 짧게 받고 '더 보기'로 잇는다. */
const PAGE_SIZE = 10;

export type FollowBox = 'FOLLOWING' | 'FOLLOWER';

/**
 * 나의 팔로우 (§14.3) — 나를 팔로우하는 사람과 내가 팔로우하는 사람. 예전 /follows 화면을 '나' 화면 안으로 옮겼다.
 * 줄을 누르면 그 사람의 마이페이지로 가고, 팔로우·취소·엽서·채팅은 모두 거기서 한다.
 * 탭 상태는 '나' 화면이 쥔다 — 위쪽 팔로워·팔로잉 숫자를 누르면 이 섹션으로 내려오며 탭이 바뀐다.
 */
export function FollowSection({ box, onChangeBox }: {
  box: FollowBox;
  onChangeBox: (box: FollowBox) => void;
}) {
  const { colors } = useTheme();
  const myId = useAuth((s) => s.user?.id);

  const myProfile = useQuery({
    queryKey: ['userProfile', myId],
    queryFn: () => profileApi.user(myId as number),
    enabled: myId != null,
  });

  const list = useInfiniteQuery({
    queryKey: ['follows', box, PAGE_SIZE],
    queryFn: ({ pageParam }) => (box === 'FOLLOWING'
      ? followApi.following(pageParam, PAGE_SIZE)
      : followApi.followers(pageParam, PAGE_SIZE)),
    initialPageParam: 0,
    // 서버가 page 를 생략해도 이미 받은 페이지 수로 다음 번호를 셀 수 있다(PostFeed 와 같은 셈).
    getNextPageParam: (last, all) => (last.hasNext ? (last.page ?? all.length - 1) + 1 : undefined),
  });

  const items = list.data?.pages.flatMap((page) => page.content ?? []) ?? [];
  // 프로필 줄과 같은 순서(팔로워 → 팔로잉) — 숫자를 누르고 내려왔을 때 탭 자리가 엇갈리지 않게.
  const options: { value: FollowBox; label: string }[] = [
    { value: 'FOLLOWER', label: `팔로워 ${myProfile.data?.followerCount ?? 0}` },
    { value: 'FOLLOWING', label: `팔로잉 ${myProfile.data?.followingCount ?? 0}` },
  ];

  return (
    <View style={styles.section}>
      <Eyebrow>팔로우</Eyebrow>
      <Segmented options={options} value={box} onChange={onChangeBox} />

      {list.isLoading ? (
        <View style={styles.status}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : list.isError ? (
        <EmptyState
          title="목록을 불러오지 못했어요"
          action={
            <Pressable
              onPress={() => list.refetch()}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => pressed && pressedStyle}
            >
              <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('다시 시도', 'action')}</Text>
            </Pressable>
          }
        />
      ) : items.length === 0 ? (
        box === 'FOLLOWING' ? (
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
      ) : (
        <Card style={styles.card}>
          {items.map((user, index) => (
            <View key={user.userId}>
              {index > 0 ? <Rule /> : null}
              <FollowRow user={user} />
            </View>
          ))}
          {list.hasNextPage ? (
            <>
              <Rule />
              <Pressable
                onPress={() => list.fetchNextPage()}
                disabled={list.isFetchingNextPage}
                accessibilityRole="button"
                style={({ pressed }) => [styles.more, pressed && pressedStyle]}
              >
                {list.isFetchingNextPage ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('더 보기', 'action')}</Text>
                )}
              </Pressable>
            </>
          ) : null}
        </Card>
      )}
    </View>
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
      style={({ pressed }) => [styles.row, pressed && pressedStyle]}
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
  section: { gap: spacing.md },
  status: { paddingVertical: spacing.lg, alignItems: 'center' },
  card: { paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  avatar: {
    width: 36, height: 36, borderRadius: radius.round,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  more: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
