import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { profileApi, walletApi } from '@/api/endpoints';
import { Card, Eyebrow, Rule, linkLabel } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { spacing, typeScale, useTheme } from '@/theme';

/** 나의 소셜 (§14.3) — 팔로우 · 방문 기록. 지갑(잔액·교환·구독)은 app/wallet.tsx 로 옮겨 갔다. */
export function SocialCard() {
  const router = useRouter();
  const { colors } = useTheme();
  const myId = useAuth((s) => s.user?.id);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const myProfile = useQuery({
    queryKey: ['userProfile', myId],
    queryFn: () => profileApi.user(myId as number),
    enabled: myId != null,
  });

  const p = myProfile.data;
  // 방문자 보기는 구독자 전용 — 지갑 응답의 구독 여부만 여기서 쓴다.
  const subscribed = wallet.data?.subscriptionActive ?? false;
  const openSubscription = () => {
    router.push({ pathname: '/subscription', params: { feature: 'visitors' } });
  };

  return (
    <View style={styles.section}>
      <Rule />
      <Eyebrow>소셜</Eyebrow>

      {/* 팔로우 · 방문 */}
      <Card>
        {/* 눌러 팔로우 목록으로 (§14.3) */}
        <Pressable
          onPress={() => router.push({ pathname: '/follows', params: { tab: 'FOLLOWING' } })}
          accessibilityRole="button"
          style={styles.linkRow}
        >
          <Text style={[typeScale.body, { color: colors.textMuted }]}>
            팔로잉 {p?.followingCount ?? 0}명
          </Text>
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('목록 보기')}</Text>
        </Pressable>
        <Rule />
        <Pressable
          onPress={() => router.push({ pathname: '/follows', params: { tab: 'FOLLOWER' } })}
          accessibilityRole="button"
          style={styles.linkRow}
        >
          <Text style={[typeScale.body, { color: colors.textMuted }]}>
            팔로워 {p?.followerCount ?? 0}명
          </Text>
          <Text style={[typeScale.monoLabel, { color: colors.accent }]}>{linkLabel('목록 보기')}</Text>
        </Pressable>
        <Rule />
        <Pressable
          onPress={subscribed ? () => router.push('/visitors') : openSubscription}
          accessibilityRole="button"
          style={styles.linkRow}
        >
          <Text style={[typeScale.body, { color: colors.textMuted }]}>
            내 페이지 방문 {p?.visitCount ?? 0}회
          </Text>
          <Text style={[typeScale.monoLabel, { color: subscribed ? colors.accent : colors.textFaint }]}>
            {linkLabel('방문자 보기')}
          </Text>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
});
