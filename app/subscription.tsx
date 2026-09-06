import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

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

export default function SubscriptionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: walletApi.get });
  const checkout = useMutation({
    mutationFn: (provider: SubscriptionProvider) => subscriptionApi.begin(provider),
    onSuccess: (view) => {
      if (view.checkoutUrl) {
        Linking.openURL(view.checkoutUrl).catch(() => {});
      }
    },
  });

  const price = wallet.data?.subscriptionPriceKrw ?? 17900;
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
              <Text style={[styles.price, { color: colors.text }]}>{price.toLocaleString()}원</Text>
              <Text style={[typeScale.monoLabel, { color: colors.textFaint }]}>/ 월</Text>
            </View>
          </Card>

          <Card>
            <Eyebrow plain>포함 혜택</Eyebrow>
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
            <Eyebrow plain>결제</Eyebrow>
            <View style={styles.checkoutButtons}>
              {Platform.OS === 'ios' ? (
                <Button
                  label="Apple로 구독하기"
                  onPress={() => checkout.mutate('APPLE')}
                  loading={checkout.isPending}
                />
              ) : null}
              {Platform.OS === 'android' ? (
                <Button
                  label="Google Play로 구독하기"
                  onPress={() => checkout.mutate('GOOGLE')}
                  loading={checkout.isPending}
                />
              ) : null}
              <Button
                label="웹에서 Toss 결제하기"
                variant={Platform.OS === 'web' ? 'primary' : 'outline'}
                onPress={() => checkout.mutate('TOSS')}
                loading={checkout.isPending}
              />
            </View>
            {error ? (
              <Text style={[typeScale.caption, styles.error, { color: colors.warn }]}>
                {error}
              </Text>
            ) : (
              <Text style={[typeScale.caption, styles.note, { color: colors.textFaint }]}>
                결제 승인 연동 전까지는 결제창 준비 상태만 확인합니다.
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
