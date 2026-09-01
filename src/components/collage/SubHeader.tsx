import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { spacing, typeScale } from '@/theme/tokens';

/**
 * 서브 화면 헤더 — 배경 없이 종이 위에 얹힌다(PaperScreen 안에서 쓴다).
 * 우측은 슬롯이며 기본값은 비어 있다 — 동작 없는 ⋯ 버튼을 만들지 않는다.
 */
export function SubHeader({ category, right, onBack }: {
  /** 가운데 카테고리 표기 — 모노 아이브로우. */
  category?: string;
  /** 우측 슬롯 — 없으면 자리만 비워 좌우 균형을 맞춘다. */
  right?: ReactNode;
  /** 기본 동작은 router.back(). */
  onBack?: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          style={styles.side}
        >
          <Text style={[styles.back, { color: colors.text }]}>←</Text>
        </Pressable>

        <Text numberOfLines={1} style={[typeScale.monoEyebrow, { color: colors.textFaint }]}>
          {category ?? ''}
        </Text>

        <View style={[styles.side, styles.rightSlot]}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: 'transparent' },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  // 좌우 슬롯 폭을 맞춰 가운데 카테고리가 실제 중앙에 오게 한다.
  side: { minWidth: 44, justifyContent: 'center' },
  rightSlot: { alignItems: 'flex-end' },
  back: { fontSize: 22, lineHeight: 26 },
});
