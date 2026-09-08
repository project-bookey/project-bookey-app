import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { followApi, profileApi, walletApi } from '@/api/endpoints';
import { Button, Card, Eyebrow, KeyValue, Rule } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

/** 나의 소셜 (§14.3) — 팔로우 · 방문 기록 · 팔로우 코드. 지갑(잔액·교환·구독)은 app/wallet.tsx 로 옮겨 갔다. */
export function SocialCard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const myId = useAuth((s) => s.user?.id);

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const myCode = useQuery({ queryKey: ['followCode'], queryFn: followApi.myCode });
  const myProfile = useQuery({
    queryKey: ['userProfile', myId],
    queryFn: () => profileApi.user(myId as number),
    enabled: myId != null,
  });

  const [friendCode, setFriendCode] = useState('');
  const [followMessage, setFollowMessage] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);

  const rotate = useMutation({
    mutationFn: followApi.rotateCode,
    onSuccess: (view) => queryClient.setQueryData(['followCode'], view),
  });

  const followByCode = useMutation({
    mutationFn: (code: string) => followApi.byCode(code),
    onSuccess: (view) => {
      setFriendCode('');
      setFollowError(null);
      setFollowMessage(`${view.nickname}님과 서로 팔로우했어요.`);
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (e) => {
      setFollowMessage(null);
      setFollowError(e instanceof ApiError ? e.message : '팔로우하지 못했어요.');
    },
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
        <KeyValue
          label="팔로워 · 팔로잉"
          value={`${p?.followerCount ?? 0} · ${p?.followingCount ?? 0}`}
        />
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
            방문자 보기 ›
          </Text>
        </Pressable>
      </Card>

      {/* 팔로우 코드 (§14.3) — 검색이 없으므로 지인은 이 코드로만 */}
      <Card>
        <Eyebrow plain>내 팔로우 코드</Eyebrow>
        <Text
          selectable
          style={[styles.code, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.line }]}
        >
          {myCode.data?.code ?? '................'}
        </Text>
        <View style={styles.actions}>
          <Button
            label="코드 재발급"
            variant="ghost"
            size="sm"
            onPress={() => rotate.mutate()}
            loading={rotate.isPending}
          />
        </View>
        <Rule style={{ marginVertical: spacing.sm }} />
        <Eyebrow plain>친구 코드 입력</Eyebrow>
        <View style={styles.codeInputRow}>
          <TextInput
            style={[styles.codeInput, {
              borderColor: colors.lineStrong, backgroundColor: colors.surface, color: colors.text,
            }]}
            value={friendCode}
            onChangeText={(next) => { setFriendCode(next); setFollowError(null); setFollowMessage(null); }}
            placeholder="16자리 코드"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="친구 팔로우 코드"
          />
          <Button
            label="팔로우"
            size="sm"
            onPress={() => followByCode.mutate(friendCode.trim())}
            loading={followByCode.isPending}
            disabled={friendCode.trim().length === 0}
          />
        </View>
        {followMessage ? (
          <Text style={[typeScale.caption, { color: colors.accent }]}>{followMessage}</Text>
        ) : null}
        {followError ? (
          <Text style={[typeScale.caption, { color: colors.danger }]} accessibilityRole="alert">
            {followError}
          </Text>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  code: {
    fontFamily: mono.semiBold,
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: hairline,
    marginTop: spacing.md,
  },
  codeInputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  codeInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
    fontFamily: mono.medium,
    fontSize: 14,
    letterSpacing: 1,
  },
});
