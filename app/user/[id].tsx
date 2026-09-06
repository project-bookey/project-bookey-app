import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { chatApi, followApi, postApi, profileApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { PostcardComposer } from '@/components/social/PostcardComposer';
import { Button, Card, EmptyState, Numeral, Tag, formatRelative } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

/**
 * 유저 마이페이지 (§14.3) — 피드에서 작성자를 눌러 들어온다.
 * 검색이 없으므로 여기서 어필할 방법은 엽서뿐이다. 방문하면 방문 기록이 남는다.
 */
export default function UserProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const myId = useAuth((s) => s.user?.id);
  const [composing, setComposing] = useState(false);

  const profile = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => profileApi.user(userId),
    enabled: Number.isInteger(userId),
  });
  const posts = useQuery({
    queryKey: ['userPosts', userId],
    queryFn: () => postApi.byUser(userId),
    enabled: Number.isInteger(userId),
  });

  const unfollow = useMutation({
    mutationFn: () => followApi.unfollow(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      queryClient.invalidateQueries({ queryKey: ['follows'] });
    },
  });

  const [chatError, setChatError] = useState<string | null>(null);
  /** 채팅 열기 (§14.3) — 맞팔로우일 때만 버튼이 보이지만, 서버 거절도 그대로 표시한다. */
  const openChat = useMutation({
    mutationFn: () => chatApi.open(userId),
    onSuccess: (chat) => {
      setChatError(null);
      router.push({ pathname: '/chat/[id]', params: { id: String(chat.id), name: chat.otherNickname } });
    },
    onError: (e) => setChatError(e instanceof ApiError ? e.message : '채팅을 열지 못했어요.'),
  });

  const p = profile.data;
  const me = p?.me ?? (myId != null && myId === userId);
  const items = posts.data?.content ?? [];

  const header = p ? (
    <View style={styles.head}>
      <View style={styles.identity}>
        {p.avatarUrl ? (
          <Image source={{ uri: p.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
            <Text style={[typeScale.titleSerif, { color: colors.accent }]}>
              {p.nickname.slice(0, 1)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={[typeScale.titleSerif, { color: colors.text }]}>{p.nickname}</Text>
          <View style={styles.tagRow}>
            {p.mutual ? <Tag label="맞팔로우" fg={colors.accent} bg={colors.accentSoft} /> : null}
            {!p.mutual && p.followsMe ? <Tag label="나를 팔로우" /> : null}
          </View>
        </View>
      </View>

      <View style={[styles.stats, { borderColor: colors.line }]}>
        <Stat label="팔로워" value={p.followerCount} />
        <Stat label="팔로잉" value={p.followingCount} />
        {/* 방문 수는 누구에게나 보인다 — "누가"는 구독 회원의 내 페이지에서만 (§14.2) */}
        <Stat label="방문" value={p.visitCount} />
        <Stat label="독후감" value={p.publicPostCount} />
      </View>

      {!me ? (
        <View style={styles.actions}>
          {p.mutual ? (
            <Button
              label="💬 채팅"
              onPress={() => openChat.mutate()}
              loading={openChat.isPending}
              style={{ flex: 1 }}
            />
          ) : null}
          {!composing ? (
            <Button
              label="✉ 엽서 보내기"
              variant={p.mutual ? 'outline' : 'primary'}
              onPress={() => setComposing(true)}
              style={{ flex: 1 }}
            />
          ) : null}
          {p.iFollow ? (
            <Button
              label="언팔로우"
              variant="ghost"
              onPress={() => unfollow.mutate()}
              loading={unfollow.isPending}
            />
          ) : null}
        </View>
      ) : null}
      {chatError ? (
        <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">
          {chatError}
        </Text>
      ) : null}

      {composing && !me ? (
        <PostcardComposer
          toUserId={userId}
          toNickname={p.nickname}
          onDone={() => setComposing(false)}
        />
      ) : null}

      <Text style={[typeScale.label, { color: colors.textMuted, marginTop: spacing.lg }]}>
        공개 독후감
      </Text>
    </View>
  ) : null;

  return (
    <PaperScreen>
      <SubHeader category="독자" onBack={() => router.back()} />
      <FlatList
        data={items}
        keyExtractor={(post) => String(post.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <Card>
            <Text style={[styles.postTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[typeScale.body, { color: colors.textMuted }]} numberOfLines={3}>
              {item.excerpt}
            </Text>
            <View style={styles.postFoot}>
              {item.bookTitle ? (
                <Text style={[typeScale.caption, { color: colors.textFaint, flex: 1 }]} numberOfLines={1}>
                  『{item.bookTitle}』
                </Text>
              ) : <View style={{ flex: 1 }} />}
              <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
                ♥ {item.likeCount} · {formatRelative(item.publishedAt ?? item.createdAt)}
              </Text>
            </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          profile.isError ? (
            <EmptyState title="독자를 찾을 수 없습니다" description="탈퇴했거나 잘못된 주소입니다." />
          ) : posts.isLoading || profile.isLoading ? null : (
            <EmptyState title="아직 공개 독후감이 없습니다" />
          )
        }
      />
    </PaperScreen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Numeral style={{ fontSize: 18, color: colors.text }}>{value}</Numeral>
      <Text style={[typeScale.caption, { color: colors.textFaint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: spacing.xxl },
  head: { gap: spacing.md, marginBottom: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  tagRow: { flexDirection: 'row', gap: spacing.xs },
  stats: {
    flexDirection: 'row', borderWidth: hairline, borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  postTitle: { fontFamily: serif.bold, fontSize: 16, lineHeight: 23, marginBottom: spacing.xs },
  postFoot: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
});
