import { StyleSheet, Text, View } from 'react-native';

import type { RemarkKind } from '@/api/types';
import { Eyebrow, FootAction, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

import type { FinishedBook } from './ClosingBookHead';
import { FinishCardFace } from './FinishCardFace';
import { RemarkSheet } from './RemarkSheet';
import { useDeleteRemark, useMyRemark } from './queries';

/**
 * 내 한 줄평 — 다 읽었거나 하차한 기록의 진도 카드 맨 아래 줄.
 *
 * 다 읽은 기록은 내 완독 카드(FinishCardFace — 완독할 때 본 것, 홈 '오늘의 글'에 보이는 것과 같은 짜임)를 세우고
 * 한 줄평을 카드 안 따옴표 자리에 둔다. 남긴 게 없으면 홈과 같이 '마지막 장까지 다 읽었어요'로 채운다.
 * 하차한 기록은 한 줄평 한 줄만 둔다. 어느 쪽이든 아래에 남긴 게 없으면 '한 줄평 남기기', 있으면 [고치기][삭제].
 *
 * 시트 열림은 화면이 쥔다 — 하차한 그 순간에도 같은 시트가 올라와야 해서다.
 */
export function MyRemark({ rid, bookId, book, kind, finishedAt, sheetOpen, onSheetOpenChange }: {
  rid: number;
  bookId: number;
  book: FinishedBook;
  kind: RemarkKind;
  /** 다 읽은 때 — 완독 카드 작성자 행의 '3일 전'. */
  finishedAt?: string;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
}) {
  const { colors } = useTheme();
  const mine = useMyRemark(rid);
  const remove = useDeleteRemark(rid, bookId);
  const { confirm, arm, disarm } = useDeleteConfirm<true>();
  const remark = mine.data ?? null;

  const editActions = (
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
  );

  return (
    <>
      {kind === 'FINISHED' ? (
        // 한 줄평을 받아 온 뒤에 세운다 — '다 읽었어요' 자리 글이 남긴 한 줄평으로 바뀌며 튀지 않게.
        mine.isSuccess ? (
          // 라벨·카드·버튼이 한 묶음 — 안쪽은 xs~sm 로 붙인다.
          <View style={styles.cardBlock}>
            <Eyebrow>내 완독 카드</Eyebrow>
            <FinishCardFace title={book.title} coverUrl={book.coverUrl} when={finishedAt ? formatRelative(finishedAt) : ''}>
              {remark ? (
                <Text style={[styles.body, { color: colors.text }]}>“{remark.body}”</Text>
              ) : (
                <Text style={[styles.body, { color: colors.textMuted }]}>마지막 장까지 다 읽었어요</Text>
              )}
            </FinishCardFace>
            {remark ? editActions : (
              <View style={styles.actions}>
                <FootAction label="한 줄평 남기기" onPress={() => onSheetOpenChange(true)} />
              </View>
            )}
          </View>
        ) : null
      ) : remark ? (
        // 라벨·한 줄·버튼이 한 묶음 — 안쪽은 xs~sm 로 붙인다.
        <View style={styles.block}>
          <Eyebrow>내 한 줄평</Eyebrow>
          <Text style={[styles.body, { color: colors.text }]}>“{remark.body}”</Text>
          {editActions}
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
  // 카드는 라벨보다 덩치가 커 라벨과 붙으면 답답하다 — 같은 묶음 안에서 한 단 넓힌다.
  cardBlock: { gap: spacing.sm },
  body: { fontFamily: serif.regular, fontSize: 15, lineHeight: 24 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  emptyText: { flexShrink: 1 },
});
