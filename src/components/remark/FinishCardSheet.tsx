import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { NoteSheet } from '@/components/note/NoteSheet';
import { Button, TextLink } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/theme';

import type { FinishedBook } from './ClosingBookHead';
import { FinishCardFace, RemarkCardCount, RemarkCardInput } from './FinishCardFace';
import { useSaveRemark } from './queries';

/**
 * 완독 카드 시트 — 책을 다 읽은 그 순간(타이머 완독 · 도서 상세 '완독 처리')에 아래에서 올라온다.
 *
 * 축하 인사 밑에 내 완독 카드(FinishCardFace — 홈 '오늘의 글'의 완독 조각과 같은 짜임)를 보여 주고,
 * 한 줄평은 그 카드의 따옴표 자리에 바로 적는다. 완독 때 리뷰는 묻지 않는다(사용자 결정 2026-10-05) —
 * 리뷰는 도서 상세 리뷰 탭의 '쓰기'로 쓴다.
 *
 * 열 때만 그리고 닫으면 걷어 낸다(한 줄평 시트와 같이). initial 은 이번 완독에 이미 남긴 한 줄평 — 그 글로 채워 연다.
 * 같은 카드는 나중에도 도서 상세 '내 진도' 카드(MyRemark)에서 다시 볼 수 있다.
 *
 * 버튼 줄 밑의 '독후감으로 길게 쓰기'는 한 줄로 모자란 사람을 그 책이 골라진 독후감 쓰기로 보낸다 — 쓰고 싶은
 * 마음이 가장 큰 순간의 입구(사용자 결정 2026-10-05). 강조는 '남기기' 하나라 글자 링크로 낮춘다.
 * 칸에 적어 둔 한 줄평은 버리지 않고 먼저 남긴다. 화면은 시트가 다 닫힌 뒤에 넘긴다 — 모달이 닫히는 도중에
 * 화면을 넘기면 둘이 엇갈린다.
 */
export function FinishCardSheet({ rid, bookId, book, initial, onClose, onWritePost }: {
  rid: number;
  bookId: number;
  book: FinishedBook;
  initial?: string;
  onClose: () => void;
  /** 시트가 다 닫힌 뒤 불린다 — 독후감 쓰기로 넘긴다. */
  onWritePost: () => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(initial ?? '');
  const save = useSaveRemark(rid, bookId);
  /** 독후감 쓰기로 떠나는 중 — 시트를 내리고, 다 내려가면 onWritePost 를 부른다. */
  const [leaving, setLeaving] = useState(false);
  const left = useRef(false);

  const error = save.isError && !save.isPending
    ? save.error instanceof ApiError ? save.error.message : '남기지 못했어요 · 다시 시도'
    : null;
  const unchanged = initial != null && draft.trim() === initial.trim();

  // 닫힘이 끝난 때 한 번만 넘긴다 — iOS 는 Modal onDismiss 와 아래 시간 중 먼저 온 쪽.
  const finishLeaving = useCallback(() => {
    if (left.current) return;
    left.current = true;
    onWritePost();
  }, [onWritePost]);

  // onDismiss 는 iOS 에만 있다. Android·웹은 다음 프레임에 넘기고, iOS 도 혹시 불리지 않을 때를 시간으로 막는다.
  useEffect(() => {
    if (!leaving) return undefined;
    if (Platform.OS !== 'ios') {
      const frame = requestAnimationFrame(finishLeaving);
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(finishLeaving, 350);
    return () => clearTimeout(timer);
  }, [leaving, finishLeaving]);

  const writePost = () => {
    if (save.isPending || leaving) return;
    const text = draft.trim();
    if (text.length > 0 && !unchanged) {
      // 남기지 못하면 시트에 머문다 — 오류는 버튼 위에 뜬다.
      save.mutate(text, { onSuccess: () => setLeaving(true) });
    } else {
      setLeaving(true);
    }
  };

  return (
    <NoteSheet visible={!leaving} title="완독" onClose={onClose} onDismiss={leaving ? finishLeaving : undefined} scroll>
      <View style={styles.content}>
        {/* ① 축하 — 인사와 읽은 기간. */}
        <View style={styles.head}>
          <Text style={[typeScale.titleSerif, styles.center, { color: colors.text }]}>완독을 축하해요</Text>
          {book.meta ? (
            <Text numberOfLines={1} style={[typeScale.monoLabel, styles.center, { color: colors.textFaint }]}>
              {book.meta}
            </Text>
          ) : null}
        </View>

        {/* ② 내 완독 카드 — 카드와 글자 수 줄이 한 묶음. */}
        <View style={styles.cardBlock}>
          <FinishCardFace title={book.title} coverUrl={book.coverUrl} when="방금">
            <RemarkCardInput value={draft} onChange={setDraft} />
          </FinishCardFace>
          <RemarkCardCount length={draft.length} />
        </View>

        {/* 실패 안내는 버튼 바로 위에 붙인다(Proximity). */}
        <View style={styles.footer}>
          {error ? <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}
          {/* 앱 전체 순서 — [취소][주요 버튼]. 짧은 글이라 '남기기'. */}
          <View style={styles.actions}>
            <Button label="나중에" variant="outline" onPress={onClose} disabled={save.isPending || leaving} style={styles.action} />
            <Button
              label="남기기"
              onPress={() => save.mutate(draft.trim(), { onSuccess: onClose })}
              loading={save.isPending}
              disabled={draft.trim().length === 0 || unchanged || leaving}
              style={styles.action}
            />
          </View>
          {/* 한 줄로 모자랄 때 — 버튼 줄과 떨어진 한 줄 글자 링크. */}
          <View style={styles.more}>
            <Text style={[typeScale.caption, { color: colors.textMuted }]}>할 말이 더 있다면</Text>
            <TextLink label="독후감으로 길게 쓰기" onPress={writePost} />
          </View>
        </View>
      </View>
    </NoteSheet>
  );
}

const styles = StyleSheet.create({
  // 묶음 사이는 lg, 묶음 안은 xs~sm — 축하 · 카드 · 버튼 세 덩어리가 간격만으로 읽히게.
  content: { gap: spacing.lg },
  head: { gap: spacing.xs },
  center: { textAlign: 'center' },
  cardBlock: { gap: spacing.sm },
  footer: { gap: spacing.sm },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
