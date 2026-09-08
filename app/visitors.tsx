import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { profileApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { AVATAR_SIZE } from '@/components/quote/QuoteCard';
import { EmptyState, formatRelative } from '@/components/ui';
import { hairline, layout, spacing, typeScale, useTheme } from '@/theme';

/** 내 방문자 (§14.2) — 구독 회원 전용. 방문자를 누르면 그 사람의 마이페이지로 간다. */
export default function VisitorsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const list = useQuery({ queryKey: ['visitors'], queryFn: () => profileApi.visitors() });

  const items = list.data?.content ?? [];
  const gated = list.error instanceof ApiError && list.error.code === 'SUBSCRIPTION_REQUIRED';

  return (
    <PaperScreen>
      <SubHeader category="방문자" onBack={() => router.back()} />
      {gated ? (
        <EmptyState
          title="구독 회원 전용이에요"
          description="해당 기능은 구독자 전용 기능이에요! 구독하면 누가 다녀갔는지 볼 수 있어요."
          action={(
            <Pressable
              onPress={() => router.push({ pathname: '/subscription', params: { feature: 'visitors' } })}
              accessibilityRole="button"
              style={[styles.subscribeCta, { backgroundColor: colors.accent }]}
            >
              <Text style={[typeScale.label, { color: colors.onAccent }]}>구독하기</Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(v, i) => `${v.userId}-${i}`}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => (
            <View style={{ height: hairline, backgroundColor: colors.line }} />
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/user/${item.userId}`)}
              accessibilityRole="button"
              style={styles.row}
            >
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[typeScale.label, { color: colors.accent }]}>
                    {item.nickname.slice(0, 1)}
                  </Text>
                </View>
              )}
              <Text style={[typeScale.bodyStrong, { color: colors.text, flex: 1 }]}>
                {item.nickname}
              </Text>
              <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>
                {formatRelative(item.visitedAt)}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            list.isLoading ? null : (
              <EmptyState title="아직 방문자가 없어요" description="피드에 독후감을 올려보세요." />
            )
          }
        />
      )}
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  list: { ...layout.content, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  // 아바타는 앱 공통 크기(광장 카드·홈 '오늘의 글'과 같은 AVATAR_SIZE) — 여기서만 작으면 다른 사람처럼 보인다.
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  subscribeCta: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
  },
});
