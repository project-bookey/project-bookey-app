import { useMutation } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIAP, type Purchase } from 'expo-iap';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ApiError } from '@/api/client';
import { bookmarkPurchaseApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, Card, Eyebrow, KeyValue, Rule } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

const PRICE_PER_BOOKMARK = 200;
const PRESETS = [5, 10, 50] as const;
const BOOKMARK_SKUS = PRESETS.map((amount) => `bookey.bookmark.${amount}`);
const PENDING_CHECKOUT_KEY = 'bookey.pendingBookmarkCheckout';
const PAYMENTS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_PAYMENTS === 'true';
const LOCAL_STOREKIT_TEST = __DEV__
  && Platform.OS === 'ios'
  && process.env.EXPO_PUBLIC_LOCAL_STOREKIT_TEST === 'true';

function bonusFor(quantity: number): number {
  return quantity >= 10 ? Math.floor(quantity * 0.1) : 0;
}

function normalizeQuantity(value: string): number {
  const parsed = Number(value.replace(/[^0-9]/g, ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(999, Math.floor(parsed)));
}

function checkoutLabel() {
  return '결제창으로 구매하기';
}

export default function BookmarksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [quantity, setQuantity] = useState(10);
  const [custom, setCustom] = useState('10');
  const [notice, setNotice] = useState<string | null>(null);
  const pendingCheckout = useRef<Awaited<ReturnType<typeof bookmarkPurchaseApi.begin>> | null>(null);
  const completePurchase = async (purchase: Purchase) => {
    const view = pendingCheckout.current;
    if (!view || purchase.productId !== view.productId) return;
    if (LOCAL_STOREKIT_TEST) {
      await finishTransaction({ purchase, isConsumable: true });
      pendingCheckout.current = null;
      await AsyncStorage.removeItem(PENDING_CHECKOUT_KEY);
      setNotice(`로컬 구매 성공 콜백을 받았습니다: ${purchase.productId}`);
      return;
    }
    const provider = Platform.OS === 'ios' ? 'APPLE' : 'GOOGLE';
    const nextWallet = await bookmarkPurchaseApi.verify({
      provider,
      productId: view.productId,
      orderId: view.orderId,
      quantity: view.quantity,
      amountKrw: view.amountKrw,
      receiptData: purchase.purchaseToken ?? undefined,
      originalTransactionId: purchase.transactionId ?? purchase.id,
    });
    await finishTransaction({ purchase, isConsumable: true });
    pendingCheckout.current = null;
    await AsyncStorage.removeItem(PENDING_CHECKOUT_KEY);
    setNotice(`결제가 완료되었습니다. 책갈피 ${nextWallet.bookmarkBalance}개를 보유하고 있습니다.`);
  };
  const { connected, products, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase) => void completePurchase(purchase).catch((e) => {
      setNotice(e instanceof Error ? e.message : '결제 검증에 실패했습니다.');
    }),
    onPurchaseError: (e) => setNotice(e.message || '스토어 결제를 완료하지 못했습니다.'),
  });

  useEffect(() => {
    void AsyncStorage.getItem(PENDING_CHECKOUT_KEY).then((raw) => {
      if (raw) pendingCheckout.current = JSON.parse(raw) as Awaited<ReturnType<typeof bookmarkPurchaseApi.begin>>;
    }).catch(() => AsyncStorage.removeItem(PENDING_CHECKOUT_KEY));
  }, []);

  useEffect(() => {
    if (connected) {
      void fetchProducts({ skus: BOOKMARK_SKUS, type: 'in-app' });
    }
  }, [connected, fetchProducts]);

  const checkout = useMutation({
    mutationFn: () => bookmarkPurchaseApi.begin(
      quantity,
      Platform.OS === 'ios' ? 'APPLE' : Platform.OS === 'android' ? 'GOOGLE' : 'TOSS',
    ),
    onMutate: () => setNotice(null),
    onSuccess: async (view) => {
      if (Platform.OS === 'web') {
        if (!view.checkoutUrl) {
          setNotice('결제창을 열 수 없습니다.');
          return;
        }
        await WebBrowser.openBrowserAsync(view.checkoutUrl);
        return;
      }
      pendingCheckout.current = view;
      await AsyncStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(view));
      await requestPurchase({
        type: 'in-app',
        request: Platform.OS === 'ios'
          ? { apple: { sku: view.productId, quantity: 1 } }
          : { google: { skus: [view.productId] } },
      });
    },
  });

  const bonus = bonusFor(quantity);
  const total = quantity + bonus;
  const price = quantity * PRICE_PER_BOOKMARK;
  const selectedProduct = products.find((product) => product.id === `bookey.bookmark.${quantity}`);
  const error = checkout.error instanceof ApiError
    ? checkout.error.message
    : checkout.error
      ? '결제를 시작하지 못했습니다.'
      : null;

  const setAmount = (next: number) => {
    setNotice(null);
    setQuantity(next);
    setCustom(String(next));
  };

  return (
    <PaperScreen>
      <SubHeader category="책갈피 구매" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.block}>
          <Card style={styles.hero}>
            <Eyebrow>BOOKMARK</Eyebrow>
            <Text style={[styles.title, { color: colors.text }]}>책갈피 충전</Text>
            <Text style={[typeScale.body, styles.copy, { color: colors.textMuted }]}>
              책갈피는 엽서와 우표로 교환해 대화를 이어갈 때 사용합니다.
            </Text>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.text }]}>200원</Text>
              <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>/ 1개</Text>
            </View>
          </Card>

          <View style={styles.presets}>
            {PRESETS.map((amount) => {
              const selected = quantity === amount;
              const presetBonus = bonusFor(amount);
              return (
                <Pressable
                  key={amount}
                  onPress={() => setAmount(amount)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.preset,
                    {
                      borderColor: selected ? colors.ink : colors.control,
                      backgroundColor: selected ? colors.surfaceRaised : colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.presetTitle, { color: colors.text }]}>{amount}개</Text>
                  <Text style={[typeScale.monoLabel, { color: presetBonus > 0 ? colors.accent : colors.textFaint }]}>
                    {presetBonus > 0 ? `${amount}+${presetBonus}` : `${amount}`}
                  </Text>
                  <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                    {products.find((product) => product.id === `bookey.bookmark.${amount}`)?.displayPrice
                      ?? `${(amount * PRICE_PER_BOOKMARK).toLocaleString()}원`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {Platform.OS === 'web' ? <Card>
            <Eyebrow>직접 입력</Eyebrow>
            <View style={styles.inputRow}>
              <TextInput
                value={custom}
                onChangeText={(value) => {
                  const next = normalizeQuantity(value);
                  setNotice(null);
                  setCustom(value.replace(/[^0-9]/g, ''));
                  setQuantity(next);
                }}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={3}
                accessibilityLabel="구매할 책갈피 개수"
                style={[
                  styles.input,
                  { borderColor: colors.lineStrong, backgroundColor: colors.surface, color: colors.text },
                ]}
              />
              <Text style={[typeScale.bodyStrong, { color: colors.text }]}>개</Text>
            </View>
            <Text style={[typeScale.caption, styles.hint, { color: colors.textFaint }]}>
              10개부터 구매 수량의 10%를 추가로 드립니다.
            </Text>
          </Card> : null}

          <Card>
            <Eyebrow>결제 요약</Eyebrow>
            <View style={{ marginTop: spacing.sm }}>
              <KeyValue label="구매 수량" value={`${quantity}개`} />
              <Rule />
              <KeyValue label="보너스" value={bonus > 0 ? `${bonus}개` : '없음'} />
              <Rule />
              <KeyValue label="충전 합계" value={`${total}개`} />
              <Rule />
              <KeyValue
                label="결제 금액"
                value={Platform.OS === 'web'
                  ? `${price.toLocaleString()}원`
                  : selectedProduct?.displayPrice ?? '스토어 가격 확인 중'}
              />
            </View>
            <Button
              label={PAYMENTS_ENABLED ? checkoutLabel() : '스토어 결제 준비 중'}
              style={styles.checkout}
              disabled={!PAYMENTS_ENABLED || quantity < 1 || (Platform.OS !== 'web' && (!connected || !selectedProduct))}
              onPress={() => checkout.mutate()}
              loading={checkout.isPending}
            />
            {error ? (
              <Text style={[typeScale.caption, styles.notice, { color: colors.warn }]}>
                {error}
              </Text>
            ) : notice ? (
              <Text style={[typeScale.caption, styles.notice, { color: colors.warn }]}>
                {notice}
              </Text>
            ) : Platform.OS !== 'web' && !PRESETS.includes(quantity as typeof PRESETS[number]) ? (
              <Text style={[typeScale.caption, styles.notice, { color: colors.textMuted }]}>5개, 10개, 50개 묶음 중 하나를 선택해 주세요.</Text>
            ) : !PAYMENTS_ENABLED ? (
              <Text style={[typeScale.caption, styles.notice, { color: colors.textMuted }]}> 
                안전한 인앱 결제를 준비하고 있습니다.
              </Text>
            ) : null}
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
  copy: { lineHeight: 22 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  price: { ...typeScale.display, fontSize: 30, letterSpacing: 0 },
  presets: { flexDirection: 'row', gap: spacing.sm },
  preset: {
    flex: 1,
    minHeight: 104,
    borderRadius: radius.md,
    borderWidth: hairline,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  presetTitle: { ...typeScale.title, fontSize: 18, lineHeight: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: hairline,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    fontWeight: '700',
  },
  hint: { marginTop: spacing.sm, lineHeight: 18 },
  checkout: { marginTop: spacing.md },
  notice: { marginTop: spacing.md, lineHeight: 18 },
});
