import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PaperScreen, SubHeader } from '@/components/collage';
import { Button, Card, Eyebrow, KeyValue, Rule } from '@/components/ui';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

const PRICE_PER_BOOKMARK = 200;
const PRESETS = [5, 10, 50] as const;

function bonusFor(quantity: number): number {
  return quantity >= 10 ? Math.floor(quantity * 0.1) : 0;
}

function normalizeQuantity(value: string): number {
  const parsed = Number(value.replace(/[^0-9]/g, ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(999, Math.floor(parsed)));
}

export default function BookmarksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [quantity, setQuantity] = useState(10);
  const [custom, setCustom] = useState('10');
  const [notice, setNotice] = useState<string | null>(null);

  const bonus = bonusFor(quantity);
  const total = quantity + bonus;
  const price = quantity * PRICE_PER_BOOKMARK;

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
            <Eyebrow plain>BOOKMARK</Eyebrow>
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
                      borderColor: selected ? colors.accent : colors.line,
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.presetTitle, { color: colors.text }]}>{amount}개</Text>
                  <Text style={[typeScale.monoLabel, { color: presetBonus > 0 ? colors.accent : colors.textFaint }]}>
                    {presetBonus > 0 ? `${amount}+${presetBonus}` : `${amount}`}
                  </Text>
                  <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                    {(amount * PRICE_PER_BOOKMARK).toLocaleString()}원
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Card>
            <Eyebrow plain>직접 입력</Eyebrow>
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
          </Card>

          <Card>
            <Eyebrow plain>결제 요약</Eyebrow>
            <View style={{ marginTop: spacing.sm }}>
              <KeyValue label="구매 수량" value={`${quantity}개`} />
              <Rule />
              <KeyValue label="보너스" value={bonus > 0 ? `${bonus}개` : '없음'} />
              <Rule />
              <KeyValue label="충전 합계" value={`${total}개`} />
              <Rule />
              <KeyValue label="결제 금액" value={`${price.toLocaleString()}원`} />
            </View>
            <Button
              label="구매하기"
              style={styles.checkout}
              disabled={quantity < 1}
              onPress={() => setNotice('책갈피 결제는 Toss 결제 계약 후 연결됩니다.')}
            />
            {notice ? (
              <Text style={[typeScale.caption, styles.notice, { color: colors.warn }]}>
                {notice}
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
