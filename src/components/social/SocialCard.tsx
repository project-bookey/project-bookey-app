import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { followApi, profileApi, walletApi } from '@/api/endpoints';
import { Button, Card, Eyebrow, KeyValue, Rule, Tag } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';
import { mono } from '@/theme/tokens';

/**
 * 나의 소셜 (§14.2·14.3) — 지갑 · 엽서함 · 팔로우 코드 · 방문 기록.
 * 프로필 화면의 한 구획으로 들어간다.
 */
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

  const exchange = useMutation({
    mutationFn: (target: 'POSTCARD' | 'STAMP') => walletApi.exchange(target, 1),
    onSuccess: (view) => queryClient.setQueryData(['wallet'], view),
  });

  const w = wallet.data;
  const p = myProfile.data;
  const subscribed = w?.subscriptionActive ?? false;
  const openSubscription = () => {
    router.push({ pathname: '/subscription', params: { feature: 'visitors' } });
  };

  return (
    <View style={styles.section}>
      <Rule />
      <Eyebrow>소셜</Eyebrow>

      {/* 지갑 (§14.2) — 책갈피가 기축, 엽서·우표로 교환 */}
      <Card>
        <View style={styles.walletHead}>
          <Eyebrow plain>지갑</Eyebrow>
          {subscribed ? <Tag label="구독 중" fg={colors.accent} bg={colors.accentSoft} /> : null}
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <KeyValue label="책갈피" value={`${w?.bookmarkBalance ?? 0}개`} />
          <Rule />
          <KeyValue label="엽서" value={`보유 ${w?.postcardBalance ?? 0}장 · 오늘 무료 ${w?.freePostcardsLeftToday ?? 0}장`} />
          <Rule />
          <KeyValue label="우표" value={`${w?.stampBalance ?? 0}개`} />
        </View>
        <View style={styles.walletActions}>
          <Button
            label="엽서로 교환 (책갈피 1)"
            variant="outline"
            size="sm"
            onPress={() => exchange.mutate('POSTCARD')}
            disabled={exchange.isPending || (w?.bookmarkBalance ?? 0) < 1}
          />
          <Button
            label="우표로 교환 (책갈피 2)"
            variant="outline"
            size="sm"
            onPress={() => exchange.mutate('STAMP')}
            disabled={exchange.isPending || (w?.bookmarkBalance ?? 0) < 2}
          />
        </View>
        {!subscribed ? (
          <View style={styles.subscribeBlock}>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              구독(월 {w ? w.subscriptionPriceKrw.toLocaleString() : '17,900'}원)하면 매달 엽서 50장 ·
              우표 30개를 드리고, 방문자와 좋아요 누른 사람을 볼 수 있어요.
            </Text>
            <Button label="구독하기" size="sm" onPress={openSubscription} />
          </View>
        ) : null}
      </Card>

      {/* 엽서함 · 팔로우 · 방문 */}
      <Card>
        <Pressable
          onPress={() => router.push('/postcards')}
          accessibilityRole="button"
          style={styles.linkRow}
        >
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>✉ 엽서함</Text>
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>열기 ›</Text>
        </Pressable>
        <Rule />
        <Pressable
          onPress={() => router.push('/chats')}
          accessibilityRole="button"
          style={styles.linkRow}
        >
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>💬 채팅</Text>
          <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>열기 ›</Text>
        </Pressable>
        <Rule />
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
            {subscribed ? '방문자 보기 ›' : '구독 전용 ›'}
          </Text>
        </Pressable>
      </Card>

      {/* 팔로우 코드 (§14.3) — 검색이 없으므로 지인은 이 코드로만 */}
      <Card>
        <Eyebrow plain>내 팔로우 코드</Eyebrow>
        <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: spacing.xs }]}>
          유저 검색이 없어요. 지인에게 이 코드를 보여주면 바로 서로 팔로우됩니다.
        </Text>
        <Text
          selectable
          style={[styles.code, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.line }]}
        >
          {myCode.data?.code ?? '................'}
        </Text>
        <View style={styles.walletActions}>
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
  walletHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  subscribeBlock: { gap: spacing.sm, marginTop: spacing.sm, alignItems: 'flex-start' },
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
