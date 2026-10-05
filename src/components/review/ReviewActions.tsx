import { StyleSheet, View } from 'react-native';

import { DeleteAction, EditAction } from '@/components/ui';
import { spacing } from '@/theme';

/**
 * 내 리뷰 '고치기'·'삭제' — 리뷰 조각(도서 상세 목록)과 리뷰 상세 카드가 머리 줄 오른쪽 위에 같은 모양으로 둔다
 * (사용자 결정, 2026-10-05). 글 옆에 붙는 자리라 한 단 작은 FootAction xs(28pt, 터치는 44pt)로 둔다(사용자 결정, 2026-10-05).
 * 고치기는 연필, 삭제는 휴지통 → '한 번 더'(앱 어디서나 같은 모양, 2026-10-05 사용자 결정).
 */
export function ReviewActions({ onEdit, onDelete, deleteConfirming = false }: {
  onEdit?: () => void;
  onDelete?: () => void;
  /** 삭제를 한 번 눌러 '한 번 더'를 기다리는 중. */
  deleteConfirming?: boolean;
}) {
  if (!onEdit && !onDelete) return null;
  return (
    <View style={styles.row}>
      {onEdit ? <EditAction size="xs" target="리뷰" onPress={onEdit} /> : null}
      {onDelete ? <DeleteAction size="xs" target="리뷰" confirming={deleteConfirming} onPress={onDelete} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
