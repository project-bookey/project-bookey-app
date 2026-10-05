import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { blockApi } from '@/api/endpoints';
import type { BlockedUser } from '@/api/types';
import { PersonGlyph } from '@/components/Avatar';
import { PaperScreen, SubHeader } from '@/components/collage';
import { EmptyState, FootAction, Loading, TextLink } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

/** 사진 지름 — 채팅 목록보다 한 단 작은 사람 줄. */
const AVATAR = 40;

/** '10월 5일' — 차단한 날. 올해가 아니면 연도도. */
function blockedDay(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const thisYear = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric' })
    .formatToParts(new Date()).find((part) => part.type === 'year')?.value;
  return `${get('year') === thisYear ? '' : `${get('year')}년 `}${get('month')}월 ${get('day')}일`;
}

/**
 * 차단한 사람 (2026-10-05) — 설정에서 들어온다. 줄마다 '차단 풀기' 한 번이면 풀린다(되돌릴 수 있는 동작이라 확인 없음).
 * 풀면 그 사람과의 엽서·채팅방이 다시 목록에 보이고, 서로 엽서·채팅을 다시 보낼 수 있다.
 */
export default function BlockedScreen() {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const list = useQuery({ queryKey: ['blocks'], queryFn: () => blockApi.list() });
  const unblock = useMutation({
    mutationFn: (userId: number) => blockApi.unblock(userId),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['postcards'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : '차단을 풀지 못했어요. 다시 시도해 주세요.'),
  });

  const pull = async () => {
    setPulling(true);
    await list.refetch();
    setPulling(false);
  };

  return (
    <PaperScreen>
      <SubHeader category="차단한 사람" />
      {list.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={list.data?.content ?? []}
          keyExtractor={(user) => String(user.userId)}
          extraData={unblock.variables}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} />}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.line }]} />}
          ListHeaderComponent={
            <View style={styles.head}>
              <Text style={[typeScale.caption, { color: colors.textMuted }]}>
                차단한 사람과는 서로 엽서와 채팅을 주고받을 수 없어요. 광장의 독후감은 그대로 보여요.
              </Text>
              {error ? (
                <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">{error}</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <BlockedRow
              user={item}
              busy={unblock.isPending && unblock.variables === item.userId}
              onUnblock={() => unblock.mutate(item.userId)}
            />
          )}
          ListEmptyComponent={
            list.isError ? (
              <EmptyState
                title="목록을 불러오지 못했어요"
                action={<TextLink label="다시 시도" kind="action" onPress={() => list.refetch()} />}
              />
            ) : (
              <EmptyState
                title="차단한 사람이 없어요"
                description="채팅 목록에서 줄을 밀거나, 채팅방의 ⋯ 메뉴에서 차단할 수 있어요."
              />
            )
          }
        />
      )}
    </PaperScreen>
  );
}

function BlockedRow({ user, busy, onUnblock }: { user: BlockedUser; busy: boolean; onUnblock: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}>
          <PersonGlyph size={AVATAR} color={colors.textFaint} />
        </View>
      )}
      <View style={styles.main}>
        <Text numberOfLines={1} style={[typeScale.bodyStrong, { color: colors.text }]}>{user.nickname}</Text>
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>{blockedDay(user.blockedAt)} 차단</Text>
      </View>
      <FootAction
        label="차단 풀기"
        onPress={onUnblock}
        disabled={busy}
        accessibilityLabel={`${user.nickname}님 차단 풀기`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingHorizontal: spacing.lg },
  head: { gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  avatar: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
  separator: { height: hairline },
});
