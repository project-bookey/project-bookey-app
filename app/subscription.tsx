import { useMutation, useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIAP, type Purchase } from 'expo-iap';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { subscriptionApi, walletApi } from '@/api/endpoints';
import type { SubscriptionProvider } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import {
  Button, Card, Eyebrow, KeyValue, Rule, Tag,
} from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

const FEATURE_COPY: Record<string, string> = {
  visitors: '누가 내 페이지를 다녀갔는지 확인할 수 있어요.',
  likers: '내 글에 좋아요를 누른 사람을 확인할 수 있어요.',
};
const PAYMENTS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_PAYMENTS === 'true';
const SUBSCRIPTION_PRODUCT_ID = process.env.EXPO_PUBLIC_SUBSCRIPTION_PRODUCT_ID || 'bookey.plus.monthly';
const PENDING_CHECKOUT_KEY = 'bookey.pendingSubscriptionCheckout';
const LOCAL_STOREKIT_TEST = __DEV__
  && Platform.OS === 'ios'
  && process.env.EXPO_PUBLIC_LOCAL_STOREKIT_TEST === 'true';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const [notice, setNotice] = useState<string | null>(null);
  const pendingCheckout = useRef<Awaited<ReturnType<typeof subscriptionApi.begin>> | null>(null);
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const completePurchase = async (purchase: Purchase) => {
    const view = pendingCheckout.current;
    if (!view || purchase.productId !== view.productId) return;
    if (LOCAL_STOREKIT_TEST) {
      await finishTransaction({ purchase, isConsumable: false });
      pendingCheckout.current = null;
      await AsyncStorage.removeItem(PENDING_CHECKOUT_KEY);
      setNotice(`로컬 구독 성공 콜백을 받았습니다: ${purchase.productId}`);
      return;
    }
    const provider: SubscriptionProvider = Platform.OS === 'ios' ? 'APPLE' : 'GOOGLE';
    await subscriptionApi.verify({
      provider,
      productId: view.productId,
      orderId: view.orderId,
      amountKrw: view.amountKrw,
      receiptData: purchase.purchaseToken ?? undefined,
      originalTransactionId: purchase.transactionId ?? purchase.id,
    });
    await finishTransaction({ purchase, isConsumable: false });
    pendingCheckout.current = null;
    await AsyncStorage.removeItem(PENDING_CHECKOUT_KEY);
    await wallet.refetch();
    setNotice('구독이 시작되었습니다.');
  };
  const { connected, subscriptions, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase) => void completePurchase(purchase).catch((e) => {
      setNotice(e instanceof Error ? e.message : '결제 검증에 실패했습니다.');
    }),
    onPurchaseError: (e) => setNotice(e.message || '스토어 결제를 완료하지 못했습니다.'),
  });

  useEffect(() => {
    void AsyncStorage.getItem(PENDING_CHECKOUT_KEY).then((raw) => {
      if (raw) pendingCheckout.current = JSON.parse(raw) as Awaited<ReturnType<typeof subscriptionApi.begin>>;
    }).catch(() => AsyncStorage.removeItem(PENDING_CHECKOUT_KEY));
  }, []);

  useEffect(() => {
    if (connected) void fetchProducts({ skus: [SUBSCRIPTION_PRODUCT_ID], type: 'subs' });
  }, [connected, fetchProducts]);

  const checkout = useMutation({
    mutationFn: (provider: SubscriptionProvider) => subscriptionApi.begin(provider),
    onMutate: () => setNotice(null),
    onSuccess: async (view) => {
      pendingCheckout.current = view;
      await AsyncStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(view));
      const androidProduct = subscriptions.find((product) => product.id === view.productId && product.platform === 'android');
      const offerToken = androidProduct?.subscriptionOffers?.[0]?.offerTokenAndroid;
      await requestPurchase({
        type: 'subs',
        request: Platform.OS === 'ios'
          ? { apple: { sku: view.productId } }
          : {
              google: {
                skus: [view.productId],
                subscriptionOffers: offerToken ? [{ sku: view.productId, offerToken }] : undefined,
              },
            },
      });
    },
  });

  const storeProduct = subscriptions.find((product) => product.id === SUBSCRIPTION_PRODUCT_ID);
  const price = storeProduct?.displayPrice
    ?? `${(LOCAL_STOREKIT_TEST ? 5900 : (wallet.data?.subscriptionPriceKrw ?? 5900)).toLocaleString()}원`;
  const storeUnavailable = !connected || !storeProduct;
  const featureCopy = feature ? FEATURE_COPY[feature] : null;
  const error = checkout.error instanceof ApiError
    ? checkout.error.message
    : checkout.error
      ? '결제를 시작하지 못했습니다.'
      : null;

  return (
    <PaperScreen>
      <SubHeader category="구독" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.block}>
          <Card style={styles.hero}>
            <Tag label="BOOKEY PLUS" fg={colors.accent} bg={colors.accentSoft} />
            <Text style={[styles.title, { color: colors.text }]}>해당 기능은 구독자 전용 기능이에요!</Text>
            {featureCopy ? (
              <Text style={[typeScale.body, { color: colors.textMuted }]}>{featureCopy}</Text>
            ) : null}
            <Text style={[typeScale.body, { color: colors.textMuted }]}>
              구독하면 소셜 신호를 더 자세히 보고, 매달 엽서와 우표를 받아 대화를 이어갈 수 있습니다.
            </Text>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.text }]}>{price}</Text>
              <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>/ 월</Text>
            </View>
          </Card>

          <Card>
            <Eyebrow>포함 혜택</Eyebrow>
            <View style={{ marginTop: spacing.sm }}>
              <KeyValue label="매월 지급" value="엽서 50장 · 우표 30개" />
              <Rule />
              <KeyValue label="방문자" value="내 페이지 방문자 열람" />
              <Rule />
              <KeyValue label="좋아요" value="내 글을 좋아한 사람 열람" />
              <Rule />
              <KeyValue label="무료 엽서" value="매일 5장 기본 제공 유지" />
            </View>
          </Card>

          <Card>
            <Eyebrow>결제</Eyebrow>
            <View style={styles.checkoutButtons}>
              {Platform.OS === 'ios' ? (
                <Button
                  label={PAYMENTS_ENABLED ? 'Apple로 구독하기' : 'App Store 결제 준비 중'}
                  onPress={() => checkout.mutate('APPLE')}
                  loading={checkout.isPending}
                  disabled={!PAYMENTS_ENABLED || (!LOCAL_STOREKIT_TEST && storeUnavailable)}
                />
              ) : null}
              {Platform.OS === 'android' ? (
                <Button
                  label={PAYMENTS_ENABLED ? 'Google Play로 구독하기' : 'Google Play 결제 준비 중'}
                  onPress={() => checkout.mutate('GOOGLE')}
                  loading={checkout.isPending}
                  disabled={!PAYMENTS_ENABLED || storeUnavailable}
                />
              ) : null}
            </View>
            {error ? (
              <Text style={[typeScale.caption, styles.error, { color: colors.warn }]}>
                {error}
              </Text>
            ) : notice ? (
              <Text style={[typeScale.caption, styles.note, { color: colors.textMuted }]}>
                {notice}
              </Text>
            ) : !PAYMENTS_ENABLED ? (
              <Text style={[typeScale.caption, styles.note, { color: colors.textMuted }]}> 
                스토어 인앱 결제를 준비하고 있습니다.
              </Text>
            ) : (
              <Text style={[typeScale.caption, styles.note, { color: colors.textFaint }]}>
                앱 결제 완료 후 서버에서 결제를 다시 검증합니다.
              </Text>
            )}
          </Card>
        </View>
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, paddingBottom: spacing.xxl, gap: spacing.xl },
  block: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  hero: { gap: spacing.md },
  title: { ...typeScale.title, lineHeight: 30 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  price: { ...typeScale.display, fontSize: 30, letterSpacing: 0 },
  checkoutButtons: { gap: spacing.sm, marginTop: spacing.md },
  note: { marginTop: spacing.md, lineHeight: 18 },
  error: {
    marginTop: spacing.md,
    lineHeight: 18,
    borderTopWidth: hairline,
    borderRadius: radius.sm,
    paddingTop: spacing.sm,
  },
});
