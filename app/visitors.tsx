import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@/navigation';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { profileApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { AVATAR_SIZE, PersonGlyph } from '@/components/Avatar';
import { Button, EmptyState, formatRelative } from '@/components/ui';
import { hairline, layout, pressedStyle, spacing, typeScale, useTheme } from '@/theme';

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
          title="구독하면 볼 수 있어요"
          description="구독하면 누가 내 페이지에 다녀갔는지 볼 수 있어요."
          action={(
            <Button
              label="구독하기"
              onPress={() => router.push({ pathname: '/subscription', params: { feature: 'visitors' } })}
            />
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
              style={({ pressed }) => [styles.row, pressed && pressedStyle]}
            >
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}>
                  <PersonGlyph size={AVATAR_SIZE} color={colors.textFaint} />
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
              <EmptyState title="아직 방문자가 없어요" description="광장에 독후감을 올려 보세요." />
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
});
