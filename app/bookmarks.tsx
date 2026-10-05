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
import { Button, Card, Eyebrow, KeyValue, Rule, linkLabel } from '@/components/ui';
import { openLegal } from '@/legal/links';
import { hairline, layout, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

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
  return '구매하기';
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
    setNotice(`결제를 마쳤어요. 이제 책갈피가 ${nextWallet.bookmarkBalance}개예요.`);
  };
  const { connected, products, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase) => void completePurchase(purchase).catch((e) => {
      setNotice(e instanceof Error ? e.message : '결제를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.');
    }),
    onPurchaseError: (e) => setNotice(e.message || '스토어 결제를 마치지 못했어요.'),
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
          setNotice('결제창을 열지 못했어요.');
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
      ? '결제를 시작하지 못했어요.'
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
              책갈피는 엽서나 우표로 바꿔서 다른 독자와 이야기를 이어 갈 때 써요.
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
                  style={({ pressed }) => [
                    styles.preset,
                    {
                      borderColor: selected ? colors.ink : colors.control,
                      backgroundColor: selected ? colors.surfaceRaised : colors.surface,
                    },
                    pressed && !selected && pressedStyle,
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
              10개 이상 사면 10%를 더 드려요.
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
              <Text style={[typeScale.caption, styles.notice, { color: colors.textMuted }]}>5개, 10개, 50개 묶음 중 하나를 골라 주세요.</Text>
            ) : !PAYMENTS_ENABLED ? (
              <Text style={[typeScale.caption, styles.notice, { color: colors.textMuted }]}> 
                앱 결제를 준비하고 있어요.
              </Text>
            ) : null}
            {/* 환불 조건은 결제 버튼 바로 아래에 — 구매 전에 표시한다(이용약관 제7조). 앱 결제는 마켓이 환불한다. */}
            <View style={styles.refund}>
              <Text style={[typeScale.caption, styles.refundCopy, { color: colors.textMuted }]}>
                {Platform.OS === 'web'
                  ? '결제 후 7일 안에 쓰지 않은 책갈피는 수수료 없이 환불돼요. 엽서·우표로 바꾸거나 쓴 책갈피와 보너스는 환불되지 않아요.'
                  : `환불은 ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'} 절차를 따라요. 엽서·우표로 바꾸거나 쓴 책갈피와 보너스는 환불되지 않아요.`}
              </Text>
              <Pressable
                onPress={() => openLegal('refund')}
                accessibilityRole="link"
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                style={({ pressed }) => [styles.refundLink, pressed && pressedStyle]}
              >
                <Text style={[typeScale.caption, { color: colors.textMuted }]}>{linkLabel('환불 정책')}</Text>
              </Pressable>
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
  refund: { marginTop: spacing.md, gap: spacing.xs },
  refundCopy: { lineHeight: 18 },
  refundLink: { alignSelf: 'flex-start' },
});
