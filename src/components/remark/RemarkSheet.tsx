import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { RemarkKind } from '@/api/types';
import { NoteSheet } from '@/components/note/NoteSheet';
import { ClosingBookHead, type FinishedBook } from '@/components/review/FinishReviewSheet';
import { Button } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/theme';

import { RemarkField } from './RemarkField';
import { useSaveRemark } from './queries';

const HEADING: Record<RemarkKind, string> = {
  FINISHED: '다 읽었어요',
  ABANDONED: '내려놓았어요',
};
const SHEET_TITLE: Record<RemarkKind, string> = {
  FINISHED: '완독',
  ABANDONED: '하차',
};

/**
 * 한 마디 시트 — 하차한 그 순간, 그리고 나중에 '한 마디 남기기'·'고치기'로 연다.
 * 완독한 순간은 완독 시트(FinishReviewSheet)의 첫 단계가 같은 칸으로 받는다.
 *
 * initial 이 있으면 고치기 — 지금 한 마디를 채워 열고 [취소][저장]. 없으면 [나중에][남기기].
 * 열 때만 그리고 닫으면 걷어 낸다(완독 시트와 같이) — 다시 열면 지난 실패 없이 지금 한 마디나 빈 칸에서 시작한다.
 */
export function RemarkSheet({ rid, bookId, book, kind, initial, onClose }: {
  rid: number;
  bookId: number;
  book: FinishedBook;
  /** 기록의 지금 상태 — 머리 인사와 빈 칸 보기가 갈린다. */
  kind: RemarkKind;
  initial?: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const editing = initial != null;
  const [draft, setDraft] = useState(initial ?? '');
  const save = useSaveRemark(rid, bookId);

  const error = save.isError && !save.isPending
    ? save.error instanceof ApiError ? save.error.message : '남기지 못했어요 · 다시 시도'
    : null;
  const unchanged = editing && draft.trim() === initial?.trim();

  return (
    <NoteSheet visible title={SHEET_TITLE[kind]} onClose={onClose} scroll>
      <View style={styles.content}>
        <ClosingBookHead book={book} heading={HEADING[kind]} />
        <RemarkField value={draft} onChange={setDraft} kind={kind} />
        {/* 실패 안내는 버튼 바로 위에 붙인다(Proximity). */}
        <View style={styles.footer}>
          {error ? <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}
          {/* 앱 전체 순서 — [취소][주요 버튼]. 짧은 글은 '남기기', 고칠 땐 '저장'. */}
          <View style={styles.actions}>
            <Button
              label={editing ? '취소' : '나중에'}
              variant="outline"
              onPress={onClose}
              disabled={save.isPending}
              style={styles.action}
            />
            <Button
              label={editing ? '저장' : '남기기'}
              onPress={() => save.mutate(draft.trim(), { onSuccess: onClose })}
              loading={save.isPending}
              disabled={draft.trim().length === 0 || unchanged}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </NoteSheet>
  );
}

const styles = StyleSheet.create({
  // 묶음 사이는 lg, 묶음 안은 xs~sm — 완독 시트와 같은 리듬.
  content: { gap: spacing.lg },
  footer: { gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
