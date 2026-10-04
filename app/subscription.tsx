import { useMutation, useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIAP, type Purchase } from 'expo-iap';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { subscriptionApi, walletApi } from '@/api/endpoints';
import type { SubscriptionProvider } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import {
  Button, Card, Eyebrow, KeyValue, Rule, Tag, linkLabel,
} from '@/components/ui';
import { openLegal, type LegalSection } from '@/legal/links';
import { hairline, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

const FEATURE_COPY: Record<string, string> = {
  visitors: '누가 내 페이지를 다녀갔는지 확인할 수 있어요.',
  likers: '내 글에 좋아요를 누른 사람을 확인할 수 있어요.',
};
const PAYMENTS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_PAYMENTS === 'true';
const SUBSCRIPTION_PRODUCT_ID = process.env.EXPO_PUBLIC_SUBSCRIPTION_PRODUCT_ID || 'bookey.plus.monthly';
const PENDING_CHECKOUT_KEY = 'bookey.pendingSubscriptionCheckout';
/** 구독을 받는 앱 마켓 — 웹에는 구독 결제가 없어 묶어 부른다. */
const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : Platform.OS === 'android' ? 'Google Play' : '스토어';
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
    setNotice('구독을 시작했어요.');
  };
  const { connected, subscriptions, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase) => void completePurchase(purchase).catch((e) => {
      setNotice(e instanceof Error ? e.message : '결제를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.');
    }),
    onPurchaseError: (e) => setNotice(e.message || '스토어 결제를 마치지 못했어요.'),
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
      ? '결제를 시작하지 못했어요.'
      : null;

  return (
    <PaperScreen>
      <SubHeader category="구독" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.block}>
          <Card style={styles.hero}>
            <Tag label="BOOKEY PLUS" fg={colors.accent} bg={colors.accentSoft} />
            <Text style={[styles.title, { color: colors.text }]}>구독하면 쓸 수 있는 기능이에요</Text>
            {featureCopy ? (
              <Text style={[typeScale.body, { color: colors.textMuted }]}>{featureCopy}</Text>
            ) : null}
            <Text style={[typeScale.body, { color: colors.textMuted }]}>
              구독하면 내 페이지 방문자와 좋아요 누른 사람을 볼 수 있고, 매달 엽서와 우표를 받아요.
            </Text>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.text }]}>{price}</Text>
              <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>/ 월</Text>
            </View>
          </Card>

          <Card>
            <Eyebrow>포함 혜택</Eyebrow>
            <View style={{ marginTop: spacing.sm }}>
              <KeyValue label="매달 드려요" value="엽서 50장 · 우표 30개" />
              <Rule />
              <KeyValue label="방문자" value="내 페이지 방문자 보기" />
              <Rule />
              <KeyValue label="좋아요" value="내 글에 좋아요 누른 사람 보기" />
              <Rule />
              <KeyValue label="무료 엽서" value="지금처럼 매일 5장 무료" />
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
                앱 결제를 준비하고 있어요.
              </Text>
            ) : (
              <Text style={[typeScale.caption, styles.note, { color: colors.textFaint }]}>
                결제가 끝나면 Bookey에서 한 번 더 확인해요.
              </Text>
            )}
            {/* 자동 갱신 구독의 구매 전 고지 — 갱신·해지 방법과 약관·개인정보·환불 링크(App Store 심사 3.1.2 요건). */}
            <Text style={[typeScale.caption, styles.renewal, { color: colors.textMuted }]}>
              구독은 한 달마다 자동으로 갱신돼요. 이용 기간이 끝나기 24시간 전까지 {STORE_NAME} 구독 관리에서 해지하지 않으면 다음 달 요금이 결제돼요. 해지해도 남은 기간은 쓸 수 있고, 환불은 {STORE_NAME} 절차를 따라요.
            </Text>
            <View style={styles.legalLinks}>
              {([['terms', '이용약관'], ['privacy', '개인정보처리방침'], ['refund', '환불 정책']] as [LegalSection, string][]).map(([section, label]) => (
                <Pressable
                  key={section}
                  onPress={() => openLegal(section)}
                  accessibilityRole="link"
                  hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
                  style={({ pressed }) => pressed && pressedStyle}
                >
                  <Text style={[typeScale.caption, { color: colors.textMuted }]}>{linkLabel(label)}</Text>
                </Pressable>
              ))}
            </View>
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
  renewal: { marginTop: spacing.md, lineHeight: 18 },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  error: {
    marginTop: spacing.md,
    lineHeight: 18,
    borderTopWidth: hairline,
    borderRadius: radius.sm,
    paddingTop: spacing.sm,
  },
});
