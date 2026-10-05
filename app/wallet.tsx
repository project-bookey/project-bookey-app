import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Mail } from 'lucide-react-native';

import { ApiError } from '@/api/client';
import { walletApi } from '@/api/endpoints';
import { BookmarkIcon, PaperScreen, StampIcon, SubHeader } from '@/components/collage';
import { Button, Card, Eyebrow, Tag, TextLink } from '@/components/ui';
import { WalletBalances } from '@/components/wallet/WalletBalances';
import { iconStroke, layout, spacing, typeScale, useTheme } from '@/theme';

/** 교환 줄 아이콘(px). */
const EXCHANGE_ICON = 16;

/**
 * 지갑 — 프로필 상단 '지갑' 메모나 헤더 지갑 카드의 '지갑 ›'으로 들어온다.
 *
 * 보유(책갈피·엽서·우표) · 교환 · 구독을 한 화면에 모은다. 예전에는 프로필 소셜 구역의 지갑 카드가
 * 맡던 몫이라 호출하는 API·캐시 키(['wallet'])는 그대로다. 책갈피 구매는 /bookmarks,
 * 구독 시작·안내는 /subscription 이 그대로 맡고 여기서는 문만 연다.
 * 책갈피·엽서·우표는 이름 대신 아이콘 + 숫자로 쓴다(2026-10-05 사용자 결정) — 보유 세 칸은 헤더 지갑 카드와 같은 WalletBalances 이고,
 * 교환은 '책갈피 1 → 엽서 1'을 아이콘으로 그린 줄에 '교환' 버튼을 둔다. 스크린 리더는 원래 말로 읽는다.
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
              <Eyebrow>내가 가진 것</Eyebrow>
              {subscribed ? <Tag label="구독 중" fg={colors.accent} bg={colors.accentSoft} /> : null}
            </View>
            {wallet.isError ? (
              <View style={styles.errorRow}>
                <Text style={[typeScale.body, { color: colors.textMuted }]}>지갑을 불러오지 못했어요.</Text>
                <TextLink
                  label="다시 시도"
                  kind="action"
                  onPress={() => wallet.refetch()}
                  accessibilityLabel="지갑 다시 불러오기"
                  style={styles.retry}
                />
              </View>
            ) : (
              <WalletBalances wallet={w} style={styles.balances} />
            )}
            <View style={styles.actions}>
              <Button label="책갈피 구매" variant="outline" size="sm" onPress={() => router.push('/bookmarks')} />
            </View>
          </Card>

          {/* 교환 — 책갈피가 기축, 엽서(1)·우표(2)로 바꾼다. 잔액이 모자라면 버튼을 잠근다. */}
          <Card>
            <Eyebrow>교환</Eyebrow>
            <View style={styles.exchanges}>
              <ExchangeRow
                cost={1}
                to={<Mail size={EXCHANGE_ICON} color={colors.textMuted} {...iconStroke} />}
                accessibilityLabel="책갈피 1개를 엽서 1장으로 교환"
                onPress={() => exchange.mutate('POSTCARD')}
                disabled={exchange.isPending || bookmarks < 1}
              />
              <ExchangeRow
                cost={2}
                to={<StampIcon size={EXCHANGE_ICON} color={colors.textMuted} />}
                accessibilityLabel="책갈피 2개를 우표 1개로 교환"
                onPress={() => exchange.mutate('STAMP')}
                disabled={exchange.isPending || bookmarks < 2}
              />
            </View>
            <Text style={[typeScale.caption, styles.hint, { color: colors.textFaint }]}>
              바꾼 책갈피는 환불되지 않아요
            </Text>
            {exchangeError ? (
              <Text style={[typeScale.caption, styles.hint, { color: colors.danger }]} accessibilityRole="alert">
                {exchangeError}
              </Text>
            ) : null}
          </Card>

          <Card>
            <Eyebrow>구독</Eyebrow>
            <Text style={[typeScale.body, styles.copy, { color: colors.textMuted }]}>
              {subscribed
                ? '방문자 확인 같은 구독 혜택을 쓰고 있어요.'
                : `내 페이지 방문자와 좋아요 누른 사람을 볼 수 있어요.${price != null ? ` 월 ${price.toLocaleString()}원.` : ''}`}
            </Text>
            <View style={styles.actions}>
              {subscribed ? (
                <Button label="구독 안내" variant="outline" size="sm" onPress={() => router.push('/subscription')} />
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

/** 교환 한 줄 — 왼쪽은 '책갈피 n → 받는 것 1'을 아이콘으로, 오른쪽은 '교환' 버튼. */
function ExchangeRow({ cost, to, accessibilityLabel, onPress, disabled }: {
  cost: number;
  to: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.exchangeRow}>
      <View accessible accessibilityLabel={accessibilityLabel} style={styles.formula}>
        <View style={styles.formulaItem}>
          <BookmarkIcon size={EXCHANGE_ICON} color={colors.textMuted} />
          <Text style={[styles.formulaValue, { color: colors.text }]}>{cost}</Text>
        </View>
        <ArrowRight size={14} color={colors.textFaint} {...iconStroke} />
        <View style={styles.formulaItem}>
          {to}
          <Text style={[styles.formulaValue, { color: colors.text }]}>1</Text>
        </View>
      </View>
      <Button
        label="교환"
        accessibilityLabel={accessibilityLabel}
        variant="outline"
        size="sm"
        onPress={onPress}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl },
  block: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  hint: { marginTop: spacing.sm },
  balances: { marginTop: spacing.md },
  exchanges: { marginTop: spacing.sm, gap: spacing.xs },
  exchangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  formula: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  formulaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  formulaValue: { ...typeScale.monoNumeral },
  copy: { marginTop: spacing.sm },
  errorRow: { marginTop: spacing.sm, gap: spacing.xs },
  retry: { alignSelf: 'flex-start' },
});
