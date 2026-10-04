import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, Card, Eyebrow } from '@/components/ui';
import { layout, spacing, typeScale, useTheme } from '@/theme';

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function TossPaymentFailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string; message?: string; kind?: string }>();
  const code = one(params.code);
  // 토스는 사용자가 결제창을 닫으면 PAY_PROCESS_CANCELED 로 돌려보낸다 — 그때만 '취소', 나머지는 실패다.
  const cancelled = code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL';
  const message = one(params.message) ?? '결제를 마치지 못했어요.';
  const isBookmarkPurchase = one(params.kind) === 'BOOKMARK_PURCHASE';

  return (
    <PaperScreen>
      <SubHeader category="결제" onBack={() => router.replace(isBookmarkPurchase ? '/bookmarks' : '/subscription')} />
      <View style={styles.container}>
        <Card style={styles.card}>
          <Eyebrow>{isBookmarkPurchase ? '책갈피' : '구독'}</Eyebrow>
          <Text style={[styles.title, { color: colors.text }]}>{cancelled ? '결제를 취소했어요' : '결제를 마치지 못했어요'}</Text>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>
            {message}
          </Text>
          <Button
            label={isBookmarkPurchase ? '책갈피 화면으로 돌아가기' : '구독 화면으로 돌아가기'}
            onPress={() => router.replace(isBookmarkPurchase ? '/bookmarks' : '/subscription')}
            variant="outline"
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
