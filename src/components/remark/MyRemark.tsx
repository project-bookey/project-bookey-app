import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { Remark, RemarkKind } from '@/api/types';
import { useKeyboardReveal } from '@/components/keyboard';
import { Button, Eyebrow, FootAction, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

import type { FinishedBook } from './ClosingBookHead';
import { FinishCardFace, RemarkCardCount, RemarkCardInput, RemarkCardQuote } from './FinishCardFace';
import { RemarkSheet } from './RemarkSheet';
import { useDeleteRemark, useMyRemark, useSaveRemark } from './queries';

/**
 * 내 한 줄평 — 다 읽었거나 하차한 기록의 진도 카드 맨 아래 줄.
 *
 * 다 읽은 기록은 내 완독 카드(FinishCardFace — 완독할 때 본 것, 홈 '오늘의 글'에 보이는 것과 같은 짜임)를 세우고
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
      <FinishedRemark
        rid={rid}
        bookId={bookId}
        book={book}
        finishedAt={finishedAt}
        remark={remark}
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

/**
 * 다 읽은 기록의 내 완독 카드. '한 줄평 남기기'·'고치기'를 누르면 카드 안 한 줄평 자리가 입력칸으로 바뀌고,
 * 카드 밑 버튼이 [취소][남기기|저장]이 된다 — 도서 상세 리뷰 목록의 제자리 고치기와 같은 방식이다.
 */
function FinishedRemark({ rid, bookId, book, finishedAt, remark, onEditingChange }: {
  rid: number;
  bookId: number;
  book: FinishedBook;
  finishedAt?: string;
  remark: Remark | null;
  onEditingChange?: (editing: boolean) => void;
}) {
  const { colors } = useTheme();
  const save = useSaveRemark(rid, bookId);
  const reveal = useKeyboardReveal();
  const actionsRef = useRef<View>(null);
  const [editing, setEditingState] = useState(false);
  const [draft, setDraft] = useState('');

  const setEditing = (next: boolean) => {
    setEditingState(next);
    onEditingChange?.(next);
  };
  // 적는 중에 카드가 사라져도(기록 상태가 바뀌는 등) 화면이 하단 버튼을 숨긴 채 남지 않게.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onEditingChange?.(false), []);

  const startEdit = () => {
    save.reset();
    setDraft(remark?.body ?? '');
    setEditing(true);
  };

  const error = save.isError && !save.isPending
    ? save.error instanceof ApiError ? save.error.message : '남기지 못했어요 · 다시 시도'
    : null;
  const unchanged = remark != null && draft.trim() === remark.body.trim();

  return (
    // 라벨·카드·버튼이 한 묶음 — 카드는 라벨보다 덩치가 커 라벨과 붙으면 답답해 sm 로 띄운다.
    <View style={styles.cardBlock}>
      <Eyebrow>내 완독 카드</Eyebrow>
      <FinishCardFace title={book.title} coverUrl={book.coverUrl} when={finishedAt ? formatRelative(finishedAt) : ''}>
        {editing ? (
          <RemarkCardInput
            value={draft}
            onChange={setDraft}
            autoFocus
            // 입력칸을 누르면 그 밑 버튼 줄까지 키보드 위로 올린다(KeyboardScroll 안).
            onFocus={() => reveal(actionsRef)}
            onContentSizeChange={() => reveal(actionsRef, { onlyIfOpen: true })}
          />
        ) : (
          <RemarkCardQuote body={remark?.body} />
        )}
      </FinishCardFace>

      {editing ? (
        <>
          <RemarkCardCount length={draft.length} />
          {/* 실패 안내는 버튼 바로 위에 붙인다(Proximity). */}
          {error ? <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}
          {/* 앱 전체 순서 — [취소][주요 버튼]. 처음 남길 땐 '남기기', 고칠 땐 '저장'. */}
          <View ref={actionsRef} style={styles.editActions}>
            <Button label="취소" variant="outline" onPress={() => setEditing(false)} disabled={save.isPending} style={styles.editAction} />
            <Button
              label={remark ? '저장' : '남기기'}
              onPress={() => save.mutate(draft.trim(), { onSuccess: () => setEditing(false) })}
              loading={save.isPending}
              disabled={draft.trim().length === 0 || unchanged}
              style={styles.editAction}
            />
          </View>
        </>
      ) : remark ? (
        <RemarkActions rid={rid} bookId={bookId} onEdit={startEdit} />
      ) : (
        <View style={styles.actions}>
          <FootAction label="한 줄평 남기기" onPress={startEdit} />
        </View>
      )}
    </View>
  );
}

/** 남긴 한 줄평 밑 [고치기][삭제] — 삭제는 앱 어디서나 같은 말·같은 모양('삭제' → '한 번 더'). */
function RemarkActions({ rid, bookId, onEdit }: { rid: number; bookId: number; onEdit: () => void }) {
  const { colors } = useTheme();
  const remove = useDeleteRemark(rid, bookId);
  const { confirm, arm, disarm } = useDeleteConfirm<true>();
  return (
    <>
      <View style={styles.actions}>
        <FootAction label="고치기" onPress={() => { disarm(); onEdit(); }} accessibilityLabel="한 줄평 고치기" />
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
      {remove.isError && !remove.isPending ? (
        <Text style={[typeScale.caption, { color: colors.warn }]}>지우지 못했어요 · 다시 눌러 주세요</Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  cardBlock: { gap: spacing.sm },
  body: { fontFamily: serif.regular, fontSize: 15, lineHeight: 24 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  editActions: { flexDirection: 'row', gap: spacing.sm },
  editAction: { flex: 1 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  emptyText: { flexShrink: 1 },
});
