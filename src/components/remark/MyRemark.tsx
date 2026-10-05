import { StyleSheet, Text, View } from 'react-native';

import type { RemarkKind } from '@/api/types';
import { Eyebrow, FootAction } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

import type { FinishedBook } from './ClosingBookHead';
import { RemarkSheet } from './RemarkSheet';
import { useDeleteRemark, useMyRemark } from './queries';

/**
 * 내 한 마디 — 다 읽었거나 하차한 기록의 진척 카드 맨 아래 줄.
 * 남긴 게 없으면 '한 마디 남기기' 하나, 있으면 그 한 줄과 [고치기][삭제].
 *
 * 시트 열림은 화면이 쥔다 — 하차한 그 순간에도 같은 시트가 올라와야 해서다.
 */
export function MyRemark({ rid, bookId, book, kind, sheetOpen, onSheetOpenChange }: {
  rid: number;
  bookId: number;
  book: FinishedBook;
  kind: RemarkKind;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
}) {
  const { colors } = useTheme();
  const mine = useMyRemark(rid);
  const remove = useDeleteRemark(rid, bookId);
  const { confirm, arm, disarm } = useDeleteConfirm<true>();
  const remark = mine.data ?? null;

  return (
    <>
      {remark ? (
        // 라벨·한 줄·버튼이 한 묶음 — 안쪽은 xs~sm 로 붙인다.
        <View style={styles.block}>
          <Eyebrow>내 한 줄평</Eyebrow>
          <Text style={[styles.body, { color: colors.text }]}>“{remark.body}”</Text>
          <View style={styles.actions}>
            <FootAction label="고치기" onPress={() => onSheetOpenChange(true)} accessibilityLabel="한 줄평 고치기" />
            {/* 삭제는 앱 어디서나 같은 말·같은 모양 — '삭제' → '한 번 더'. */}
            <FootAction
              label={confirm ? '한 번 더' : '삭제'}
              tone={confirm ? 'danger' : 'faint'}
              disabled={remove.isPending}
              onPress={() => {
                if (confirm) { disarm(); remove.mutate(); } else arm(true);
              }}
              accessibilityLabel={confirm ? '한 줄평 삭제 확인' : '한 줄평 삭제'}
            />
          </View>
        </View>
      ) : mine.isSuccess ? (
        <View style={styles.emptyRow}>
          <Text style={[typeScale.caption, styles.emptyText, { color: colors.textMuted }]}>
            책을 덮으며 한 줄평을 남겨 보세요
          </Text>
          <FootAction label="한 줄평 남기기" onPress={() => onSheetOpenChange(true)} />
        </View>
      ) : null}
      {remove.isError && !remove.isPending ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>지우지 못했어요 · 다시 눌러 주세요</Text>
      ) : null}

      {sheetOpen ? (
        <RemarkSheet
          rid={rid}
          bookId={bookId}
          book={book}
          kind={kind}
          initial={remark?.body}
          onClose={() => onSheetOpenChange(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  body: { fontFamily: serif.regular, fontSize: 15, lineHeight: 24 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  emptyText: { flexShrink: 1 },
});
