import { StyleSheet, Text, View } from 'react-native';

import type { RemarkKind } from '@/api/types';
import { Eyebrow, FootAction } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

import type { FinishedBook } from './ClosingBookHead';
import { MyFinishCard, RemarkActions } from './MyFinishCard';
import { RemarkSheet } from './RemarkSheet';
import { useMyRemark } from './queries';

/**
 * 내 한 줄평 — 다 읽었거나 하차한 기록의 진도 카드 맨 아래 줄.
 *
 * 다 읽은 기록은 내 완독 카드(MyFinishCard — 완독할 때 본 것, 홈 '오늘의 글'에 보이는 것과 같은 짜임)를 세우고
 * 한 줄평을 카드 안 따옴표 자리에 둔다. 남기기·고치기도 시트 없이 그 자리가 입력칸으로 바뀐다(사용자 결정 2026-10-05).
 * 하차한 기록은 한 줄평 한 줄만 두고, 남기기·고치기는 한 줄평 시트로 한다.
 * 어느 쪽이든 아래에 남긴 게 없으면 '한 줄평 남기기', 있으면 [고치기][삭제].
 *
 * 시트 열림은 화면이 쥔다 — 하차한 그 순간에도 같은 시트가 올라와야 해서다.
 */
export function MyRemark({ rid, bookId, book, kind, finishedAt, sheetOpen, onSheetOpenChange, onEditingChange }: {
  rid: number;
  bookId: number;
  book: FinishedBook;
  kind: RemarkKind;
  /** 다 읽은 때 — 완독 카드 작성자 행의 '3일 전'. */
  finishedAt?: string;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
  /** 완독 카드 안에서 적는 중인지 — 화면이 하단 '독서 시작'을 숨기려고 쥔다(초록 버튼은 '저장' 하나). */
  onEditingChange?: (editing: boolean) => void;
}) {
  const { colors } = useTheme();
  const mine = useMyRemark(rid);
  const remark = mine.data ?? null;

  if (kind === 'FINISHED') {
    // 한 줄평을 받아 온 뒤에 세운다 — '다 읽었어요' 자리 글이 남긴 한 줄평으로 바뀌며 튀지 않게.
    return mine.isSuccess ? (
      <MyFinishCard
        rid={rid}
        bookId={bookId}
        title={book.title}
        coverUrl={book.coverUrl}
        finishedAt={finishedAt}
        remark={remark}
        eyebrow="내 완독 카드"
        onEditingChange={onEditingChange}
      />
    ) : null;
  }

  return (
    <>
      {remark ? (
        // 라벨·한 줄·버튼이 한 묶음 — 안쪽은 xs~sm 로 붙인다.
        <View style={styles.block}>
          <Eyebrow>내 한 줄평</Eyebrow>
          <Text style={[styles.body, { color: colors.text }]}>“{remark.body}”</Text>
          <RemarkActions rid={rid} bookId={bookId} onEdit={() => onSheetOpenChange(true)} />
        </View>
      ) : mine.isSuccess ? (
        <View style={styles.emptyRow}>
          <Text style={[typeScale.caption, styles.emptyText, { color: colors.textMuted }]}>
            책을 덮으며 한 줄평을 남겨 보세요
          </Text>
          <FootAction label="한 줄평 남기기" onPress={() => onSheetOpenChange(true)} />
        </View>
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
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  emptyText: { flexShrink: 1 },
});
