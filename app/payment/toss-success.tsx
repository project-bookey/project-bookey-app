import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { subscriptionApi } from '@/api/endpoints';
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
  }>();

  const verifyBody = useMemo(() => {
    const productId = one(params.productId);
    const paymentKey = one(params.paymentKey);
    const orderId = one(params.orderId);
    const amount = Number(one(params.amount));
    if (!productId || !paymentKey || !orderId || !Number.isFinite(amount)) {
      return null;
    }
    return {
      provider: 'TOSS' as const,
      productId,
      paymentKey,
      orderId,
      amountKrw: amount,
    };
  }, [params.amount, params.orderId, params.paymentKey, params.productId]);

  const verifyPayment = useMutation({
    mutationFn: () => {
      if (!verifyBody) {
        throw new ApiError(400, 'INVALID_REQUEST', '결제 승인 정보가 부족합니다.');
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
      ? '결제를 검증하지 못했습니다.'
      : null;

  return (
    <PaperScreen>
      <SubHeader category="결제" onBack={() => router.replace('/subscription')} />
      <View style={styles.container}>
        <Card style={styles.card}>
          <Eyebrow plain>BOOKEY PLUS</Eyebrow>
          <Text style={[styles.title, { color: colors.text }]}>
            {verifyPayment.isSuccess ? '구독이 시작되었습니다.' : '결제를 확인하고 있습니다.'}
          </Text>
          <Text style={[typeScale.body, { color: error ? colors.warn : colors.textMuted }]}>
            {error ?? (verifyPayment.isSuccess
              ? '매월 엽서와 우표가 지급되고, 구독자 전용 기능을 사용할 수 있습니다.'
              : '토스 결제 결과를 서버에서 다시 검증하는 중입니다.')}
          </Text>
          <Button
            label={verifyPayment.isSuccess ? '구독 화면으로 돌아가기' : '다시 확인하기'}
            onPress={() => (verifyPayment.isSuccess
              ? router.replace('/subscription')
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
