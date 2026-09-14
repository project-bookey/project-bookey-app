import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { walletApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, Card, Eyebrow, KeyValue, Rule, Tag } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';

/**
 * 지갑 — 프로필 상단 '지갑' 메모를 누르면 들어온다.
 *
 * 보유(책갈피·엽서·우표) · 교환 · 구독을 한 화면에 모은다. 예전에는 프로필 소셜 구역의 지갑 카드가
 * 맡던 몫이라 호출하는 API·캐시 키(['wallet'])는 그대로다. 책갈피 구매는 /bookmarks,
 * 구독 시작·안내는 /subscription 이 그대로 맡고 여기서는 문만 연다.
 */
export default function WalletScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });

  const exchange = useMutation({
    mutationFn: (target: 'POSTCARD' | 'STAMP') => walletApi.exchange(target, 1),
    // 서버가 교환 후 지갑을 통째로 돌려주므로 다시 받지 않고 그대로 앉힌다 — 프로필 메모도 같은 키라 같이 바뀐다.
    onSuccess: (view) => queryClient.setQueryData(['wallet'], view),
  });
  const exchangeError = exchange.isError && !exchange.isPending
    ? exchange.error instanceof ApiError ? exchange.error.message : '교환하지 못했어요 · 다시 시도'
    : null;

  const w = wallet.data;
  const bookmarks = w?.bookmarkBalance ?? 0;
  const subscribed = w?.subscriptionActive ?? false;
  const price = w?.subscriptionPriceKrw;

  return (
    <PaperScreen>
      <SubHeader category="지갑" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.block}>
          <Card>
            <View style={styles.head}>
              <Eyebrow plain>보유</Eyebrow>
              {subscribed ? <Tag label="구독 중" fg={colors.accent} bg={colors.accentSoft} /> : null}
            </View>
            {wallet.isError ? (
              <View style={styles.errorRow}>
                <Text style={[typeScale.body, { color: colors.textMuted }]}>지갑을 불러오지 못했어요.</Text>
                <Pressable
                  onPress={() => wallet.refetch()}
                  accessibilityRole="button"
                  accessibilityLabel="지갑 다시 불러오기"
                  style={styles.retry}
                >
                  <Text style={[typeScale.monoLabel, { color: colors.accent }]}>다시 시도 →</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                <KeyValue label="책갈피" value={`${bookmarks}개`} />
                <Rule />
                <KeyValue
                  label="엽서"
                  value={`${w?.postcardBalance ?? 0}장 · 오늘 무료 ${w?.freePostcardsLeftToday ?? 0}장`}
                />
                <Rule />
                <KeyValue label="우표" value={`${w?.stampBalance ?? 0}개`} />
              </View>
            )}
            <View style={styles.actions}>
              <Button label="책갈피 구매 →" variant="outline" size="sm" onPress={() => router.push('/bookmarks')} />
            </View>
          </Card>

          {/* 교환 — 책갈피가 기축, 엽서(1)·우표(2)로 바꾼다. 잔액이 모자라면 버튼을 잠근다. */}
          <Card>
            <Eyebrow plain>교환</Eyebrow>
            <View style={styles.actions}>
              <Button
                label="엽서로 교환 (책갈피 1)"
                variant="outline"
                size="sm"
                onPress={() => exchange.mutate('POSTCARD')}
                disabled={exchange.isPending || bookmarks < 1}
              />
              <Button
                label="우표로 교환 (책갈피 2)"
                variant="outline"
                size="sm"
                onPress={() => exchange.mutate('STAMP')}
                disabled={exchange.isPending || bookmarks < 2}
              />
            </View>
            <Text style={[typeScale.caption, styles.hint, { color: colors.textFaint }]}>
              책갈피 1개 → 엽서 1장 · 책갈피 2개 → 우표 1개
            </Text>
            {exchangeError ? (
              <Text style={[typeScale.caption, styles.hint, { color: colors.danger }]} accessibilityRole="alert">
                {exchangeError}
              </Text>
            ) : null}
          </Card>

          <Card>
            <Eyebrow plain>구독</Eyebrow>
            <Text style={[typeScale.body, styles.copy, { color: colors.textMuted }]}>
              {subscribed
                ? '방문자 확인 같은 구독 혜택을 쓰고 있어요.'
                : `방문자 확인 등 소셜 신호를 더 자세히 봅니다.${price != null ? ` 월 ${price.toLocaleString()}원.` : ''}`}
            </Text>
            <View style={styles.actions}>
              {subscribed ? (
                <Button label="구독 안내 ›" variant="ghost" size="sm" onPress={() => router.push('/subscription')} />
              ) : (
                <Button label="구독하기" size="sm" onPress={() => router.push('/subscription')} />
              )}
            </View>
          </Card>
        </View>
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl },
  block: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  hint: { marginTop: spacing.sm },
  copy: { marginTop: spacing.sm },
  errorRow: { marginTop: spacing.sm, gap: spacing.xs },
  // 웹은 hitSlop 을 무시하므로 여백으로 36px 상자를 만든다.
  retry: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
});
