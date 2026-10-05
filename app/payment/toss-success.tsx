import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from '@/navigation';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { bookmarkPurchaseApi, subscriptionApi } from '@/api/endpoints';
import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, Card, Eyebrow } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function TossPaymentSuccessScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    provider?: string;
    productId?: string;
    paymentKey?: string;
    orderId?: string;
    amount?: string;
    kind?: string;
    quantity?: string;
  }>();

  const verifyBody = useMemo(() => {
    const productId = one(params.productId);
    const paymentKey = one(params.paymentKey);
    const orderId = one(params.orderId);
    const amount = Number(one(params.amount));
    const kind = one(params.kind);
    const quantity = Number(one(params.quantity));
    if (!productId || !paymentKey || !orderId || !Number.isFinite(amount)) {
      return null;
    }
    return {
      kind,
      provider: 'TOSS' as const,
      productId,
      paymentKey,
      orderId,
      amountKrw: amount,
      quantity,
    };
  }, [params.amount, params.kind, params.orderId, params.paymentKey, params.productId, params.quantity]);

  const verifyPayment = useMutation({
    mutationFn: () => {
      if (!verifyBody) {
        throw new ApiError(400, 'INVALID_REQUEST', '결제 정보가 모자라 확인하지 못했어요.');
      }
      if (verifyBody.kind === 'BOOKMARK_PURCHASE') {
        if (!Number.isFinite(verifyBody.quantity)) {
          throw new ApiError(400, 'INVALID_REQUEST', '구매 수량 정보가 모자라 확인하지 못했어요.');
        }
        return bookmarkPurchaseApi.verify({
          provider: verifyBody.provider,
          productId: verifyBody.productId,
          paymentKey: verifyBody.paymentKey,
          orderId: verifyBody.orderId,
          amountKrw: verifyBody.amountKrw,
          quantity: verifyBody.quantity,
        }).then(() => undefined);
      }
      return subscriptionApi.verify(verifyBody);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  useEffect(() => {
    if (verifyPayment.isIdle) {
      verifyPayment.mutate();
    }
  }, [verifyPayment.isIdle, verifyPayment.mutate]);

  const error = verifyPayment.error instanceof ApiError
    ? verifyPayment.error.message
    : verifyPayment.error
      ? '결제를 확인하지 못했어요.'
      : null;

  return (
    <PaperScreen>
      <SubHeader category="결제" onBack={() => router.replace(verifyBody?.kind === 'BOOKMARK_PURCHASE' ? '/bookmarks' : '/subscription')} />
      <View style={styles.container}>
        <Card style={styles.card}>
          <Eyebrow>{verifyBody?.kind === 'BOOKMARK_PURCHASE' ? '책갈피' : '구독'}</Eyebrow>
          <Text style={[styles.title, { color: colors.text }]}>
            {verifyPayment.isSuccess
              ? verifyBody?.kind === 'BOOKMARK_PURCHASE' ? '책갈피를 충전했어요.' : '구독을 시작했어요.'
              : '결제를 확인하고 있어요.'}
          </Text>
          <Text style={[typeScale.body, { color: error ? colors.warn : colors.textMuted }]}>
            {error ?? (verifyPayment.isSuccess
              ? verifyBody?.kind === 'BOOKMARK_PURCHASE'
                ? '산 책갈피를 지갑에 넣었어요.'
                : '매달 엽서와 우표를 드리고, 구독 기능을 바로 쓸 수 있어요.'
              : '토스 결제 결과를 확인하고 있어요.')}
          </Text>
          <Button
            label={verifyPayment.isSuccess
              ? verifyBody?.kind === 'BOOKMARK_PURCHASE' ? '책갈피 화면으로 돌아가기' : '구독 화면으로 돌아가기'
              : '다시 확인하기'}
            onPress={() => (verifyPayment.isSuccess
              ? router.replace(verifyBody?.kind === 'BOOKMARK_PURCHASE' ? '/bookmarks' : '/subscription')
              : verifyPayment.mutate())}
            loading={verifyPayment.isPending}
            variant={verifyPayment.isSuccess ? 'primary' : 'outline'}
          />
        </Card>
      </View>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  container: { ...layout.content, flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: { gap: spacing.md },
  title: { ...typeScale.title, lineHeight: 30 },
});
