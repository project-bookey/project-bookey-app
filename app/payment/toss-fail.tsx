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
  const message = one(params.message) ?? '결제가 완료되지 않았습니다.';
  const code = one(params.code);
  const isBookmarkPurchase = one(params.kind) === 'BOOKMARK_PURCHASE';

  return (
    <PaperScreen>
      <SubHeader category="결제" onBack={() => router.replace(isBookmarkPurchase ? '/bookmarks' : '/subscription')} />
      <View style={styles.container}>
        <Card style={styles.card}>
          <Eyebrow plain>{isBookmarkPurchase ? 'BOOKMARK' : 'BOOKEY PLUS'}</Eyebrow>
          <Text style={[styles.title, { color: colors.text }]}>결제가 취소되었습니다.</Text>
          <Text style={[typeScale.body, { color: colors.textMuted }]}>
            {code ? `[${code}] ` : ''}{message}
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
