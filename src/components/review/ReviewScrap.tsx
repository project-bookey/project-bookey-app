import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Review } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

/**
 * 리뷰 조각 — 도서 상세에 붙인 짧은 메모. 통째로 눌러 리뷰 상세로 간다.
 * 전문은 상세에서 읽으라고 두 줄까지만 보인다.
 * 기울이지 않는다 — 읽는 목록이라 반듯하게 둔다(사용자 결정, 2026-10-04).
 */
export function ReviewScrap({ review, onPress }: {
  review: Review;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="리뷰 상세">
      <MemoScrap rotate={0}>
        <View style={styles.head}>
          <Text numberOfLines={1} style={[typeScale.label, styles.author, { color: colors.text }]}>
            {review.authorNickname}
          </Text>
          {review.rating ? (
            <Text style={[typeScale.monoNumeral, { color: colors.accent }]}>★ {review.rating}</Text>
          ) : null}
        </View>
        <Text numberOfLines={2} style={[styles.body, { color: colors.textMuted }]}>{review.body}</Text>
      </MemoScrap>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  author: { flexShrink: 1 },
  body: { fontFamily: serif.regular, fontSize: 14, lineHeight: 23, marginTop: spacing.sm },
});
