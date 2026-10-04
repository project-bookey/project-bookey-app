import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Review } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { FootAction } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

import { FinishedTag } from './FinishedTag';

/**
 * 리뷰 조각 — 도서 상세에 붙인 짧은 메모. 통째로 눌러 리뷰 상세로 간다.
 * 전문은 상세에서 읽으라고 두 줄까지만 보인다. 작성자가 이 책을 완독했으면 이름 옆에 '완독'을 붙인다.
 * 기울이지 않는다 — 읽는 목록이라 반듯하게 둔다(사용자 결정, 2026-10-04).
 * 내 리뷰면 조각 안 오른쪽 아래에 '고치기'·'삭제'를 둔다 — 상세에 들어가지 않고 그 자리에서 다룬다(사용자 결정, 2026-10-05).
 */
export function ReviewScrap({ review, onPress, onEdit, onDelete, deleteConfirming = false }: {
  review: Review;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** 삭제를 한 번 눌러 '한 번 더'를 기다리는 중. */
  deleteConfirming?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="리뷰 상세">
      <MemoScrap rotate={0}>
        <View style={styles.head}>
          <View style={styles.who}>
            <Text numberOfLines={1} style={[typeScale.label, styles.author, { color: colors.text }]}>
              {review.authorNickname}
            </Text>
            {review.authorFinished ? <FinishedTag /> : null}
          </View>
          {review.rating ? (
            <Text style={[typeScale.monoNumeral, { color: colors.accent }]}>★ {review.rating}</Text>
          ) : null}
        </View>
        <Text numberOfLines={2} style={[styles.body, { color: colors.textMuted }]}>{review.body}</Text>
        {onEdit || onDelete ? (
          <View style={styles.actions}>
            {onEdit ? <FootAction label="고치기" onPress={onEdit} accessibilityLabel="리뷰 고치기" /> : null}
            {/* 삭제는 앱 어디서나 같은 말·같은 모양 — '삭제' → '한 번 더'. */}
            {onDelete ? (
              <FootAction
                label={deleteConfirming ? '한 번 더' : '삭제'}
                onPress={onDelete}
                tone={deleteConfirming ? 'danger' : 'faint'}
                accessibilityLabel={deleteConfirming ? '리뷰 삭제 확인' : '리뷰 삭제'}
              />
            ) : null}
          </View>
        ) : null}
      </MemoScrap>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  author: { flexShrink: 1 },
  body: { fontFamily: serif.regular, fontSize: 14, lineHeight: 23, marginTop: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg, marginTop: spacing.sm },
});
