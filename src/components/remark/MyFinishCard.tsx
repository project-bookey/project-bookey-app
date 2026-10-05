import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { Remark } from '@/api/types';
import { useKeyboardReveal } from '@/components/keyboard';
import { Button, Eyebrow, FootAction, formatRelative } from '@/components/ui';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { spacing, typeScale, useTheme } from '@/theme';

import { FinishCardFace, RemarkCardCount, RemarkCardInput, RemarkCardQuote } from './FinishCardFace';
import { useDeleteRemark, useSaveRemark } from './queries';

/**
 * 다 읽은 회차의 내 완독 카드 — 한 줄평을 카드 안에서 바로 남기고 고친다(사용자 결정 2026-10-05).
 * 도서 상세 '내 진도'(MyRemark)와 내 완독 카드 모음(/finish-cards)이 같은 카드를 쓴다.
 *
 * '한 줄평 남기기'·[고치기][삭제]는 메모 안 오른쪽 아래에 한 단 작게(FootAction xs) 둔다 — 버튼이 카드 밖에 떠 있으면
 * 어느 카드 것인지 경계가 흐려져서 카드 하나를 한 덩어리로 만들었다(시안 C, 사용자 결정 2026-10-05). 리뷰 조각이
 * 고치기·삭제를 카드 안에 두는 것과 같은 방식이다. 누르면 카드 안 한 줄평 자리가 입력칸으로 바뀌고, 카드 밑에
 * [취소][남기기|저장]이 붙는다 — 도서 상세 리뷰 목록의 제자리 고치기와 같다.
 *
 * 고치는 중인지는 카드가 쥐거나(editing 을 넘기지 않을 때) 화면이 쥔다 — 모음 화면은 한 번에 한 장만 열어 둔다.
 * onOpen 을 넘기면 고치지 않는 동안 카드 본문·표지를 눌러 그 책으로 간다. 카드 안 버튼은 그 누르는 자리 밖이다.
 * KeyboardScroll · KeyboardRevealProvider 안에 둔다 — 입력칸을 누르면 그 밑 버튼 줄까지 키보드 위로 올린다.
 */
export function MyFinishCard({
  rid, bookId, title, coverUrl, finishedAt, remark, eyebrow, onOpen, editing: editingProp, onEditingChange,
}: {
  rid: number;
  bookId: number;
  title: string;
  coverUrl?: string | null;
  /** 다 읽은 때 — 작성자 행의 '3일 전'. */
  finishedAt?: string;
  remark: Remark | null;
  /** 카드 위 라벨 — 도서 상세에서는 '내 완독 카드'. 모음 화면은 화면 제목이 같은 말이라 두지 않는다. */
  eyebrow?: string;
  /** 고치지 않는 동안 카드 얼굴을 누르면 — 모음 화면에서 그 회차의 도서 상세로. */
  onOpen?: () => void;
  /** 화면이 쥘 때만 넘긴다. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const { colors } = useTheme();
  const save = useSaveRemark(rid, bookId);
  const reveal = useKeyboardReveal();
  const actionsRef = useRef<View>(null);
  const [ownEditing, setOwnEditing] = useState(false);
  const editing = editingProp ?? ownEditing;
  // 화면이 이 카드를 연 채로 다시 그려도(목록이 카드를 내렸다 올리는 등) 지금 한 줄평에서 시작한다.
  const [draft, setDraft] = useState(remark?.body ?? '');

  const setEditing = (next: boolean) => {
    setOwnEditing(next);
    onEditingChange?.(next);
  };
  // 적는 중에 카드가 사라지면(기록 상태가 바뀌거나 목록이 내리는 등) 화면이 연 채로 남지 않게 닫는다.
  // 적는 중이던 카드만 알린다 — 다른 카드가 사라질 때 지금 열린 카드까지 닫히지 않게.
  const editingRef = useRef(editing);
  editingRef.current = editing;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (editingRef.current) onEditingChange?.(false); }, []);

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
    <View style={styles.block}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <FinishCardFace
        title={title}
        coverUrl={coverUrl}
        when={finishedAt ? formatRelative(finishedAt) : ''}
        // 입력칸이 든 얼굴은 누르는 자리로 만들지 않는다 — 웹에서 <button> 안에 글 칸이 들어간다.
        onPress={onOpen && !editing ? onOpen : undefined}
        pressLabel={`${title} 완독 카드 · 도서 상세로`}
        footer={editing ? null : remark ? (
          <RemarkActions rid={rid} bookId={bookId} onEdit={startEdit} inCard />
        ) : (
          <View style={styles.inCardActions}>
            <FootAction size="xs" label="한 줄평 남기기" onPress={startEdit} />
          </View>
        )}
      >
        {editing ? (
          <RemarkCardInput
            value={draft}
            onChange={setDraft}
            autoFocus
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
      ) : null}
    </View>
  );
}

/**
 * 남긴 한 줄평 밑 [고치기][삭제] — 삭제는 앱 어디서나 같은 말·같은 모양('삭제' → '한 번 더').
 * inCard 면 완독 카드 메모 안 오른쪽 아래에 한 단 작게(xs) 붙는다. 아니면(하차한 기록의 '내 한 줄평') 글 밑 왼쪽.
 */
export function RemarkActions({ rid, bookId, onEdit, inCard = false }: {
  rid: number;
  bookId: number;
  onEdit: () => void;
  inCard?: boolean;
}) {
  const { colors } = useTheme();
  const remove = useDeleteRemark(rid, bookId);
  const { confirm, arm, disarm } = useDeleteConfirm<true>();
  const size = inCard ? 'xs' : 'sm';
  return (
    <>
      <View style={inCard ? styles.inCardActions : styles.actions}>
        <FootAction size={size} label="고치기" onPress={() => { disarm(); onEdit(); }} accessibilityLabel="한 줄평 고치기" />
        <FootAction
          size={size}
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
        <Text style={[typeScale.caption, inCard && styles.inCardNotice, { color: colors.warn }]}>지우지 못했어요 · 다시 눌러 주세요</Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  // 메모 안 맨 아래 줄 — 한 줄평과 한 묶음이라 sm 만 띄우고 오른쪽 끝에 붙인다(리뷰 조각의 고치기·삭제 자리처럼).
  inCardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  inCardNotice: { textAlign: 'right', marginTop: spacing.xs },
  editActions: { flexDirection: 'row', gap: spacing.sm },
  editAction: { flex: 1 },
});
