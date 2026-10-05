import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { NoteSheet } from '@/components/note/NoteSheet';
import { Button } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, serif } from '@/theme/tokens';

import type { FinishedBook } from './ClosingBookHead';
import { FinishCardFace } from './FinishCardFace';
import { REMARK_MAX, useSaveRemark } from './queries';

/**
 * 완독 카드 시트 — 책을 다 읽은 그 순간(타이머 완독 · 도서 상세 '완독 처리')에 아래에서 올라온다.
 *
 * 축하 인사 밑에 내 완독 카드(FinishCardFace — 홈 '오늘의 글'의 완독 조각과 같은 짜임)를 보여 주고,
 * 한 줄평은 그 카드의 따옴표 자리에 바로 적는다. 완독 때 리뷰는 묻지 않는다(사용자 결정 2026-10-05) —
 * 리뷰는 도서 상세 리뷰 탭의 '쓰기'로 쓴다.
 *
 * 열 때만 그리고 닫으면 걷어 낸다(한 줄평 시트와 같이). initial 은 이번 완독에 이미 남긴 한 줄평 — 그 글로 채워 연다.
 * 같은 카드는 나중에도 도서 상세 '내 진도' 카드(MyRemark)에서 다시 볼 수 있다.
 */
export function FinishCardSheet({ rid, bookId, book, initial, onClose }: {
  rid: number;
  bookId: number;
  book: FinishedBook;
  initial?: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(initial ?? '');
  const save = useSaveRemark(rid, bookId);

  const error = save.isError && !save.isPending
    ? save.error instanceof ApiError ? save.error.message : '남기지 못했어요 · 다시 시도'
    : null;
  const unchanged = initial != null && draft.trim() === initial.trim();

  return (
    <NoteSheet visible title="완독" onClose={onClose} scroll>
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
            <View style={styles.quoteRow}>
              <Text style={[styles.quoteMark, { color: colors.textFaint }]} aria-hidden>“</Text>
              <TextInput
                value={draft}
                // 한 문장이라 줄바꿈은 받지 않는다(엔터는 키보드를 내린다) — 한 줄평 칸(RemarkField)과 같다.
                onChangeText={(text) => setDraft(text.replace(/\s*\n\s*/g, ' '))}
                placeholder="예: 마지막 장을 덮고 한참 앉아 있었어요"
                placeholderTextColor={colors.textFaint}
                maxLength={REMARK_MAX}
                multiline
                submitBehavior="blurAndSubmit"
                returnKeyType="done"
                accessibilityLabel="한 줄평"
                style={[styles.input, {
                  backgroundColor: colors.surface, borderColor: colors.line, color: colors.text,
                }]}
              />
            </View>
          </FinishCardFace>
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>
            {`${draft.length}/${REMARK_MAX}자 · 책 정보 화면에 다른 독자의 것과 번갈아 보여요`}
          </Text>
        </View>

        {/* 실패 안내는 버튼 바로 위에 붙인다(Proximity). */}
        <View style={styles.footer}>
          {error ? <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}
          {/* 앱 전체 순서 — [취소][주요 버튼]. 짧은 글이라 '남기기'. */}
          <View style={styles.actions}>
            <Button label="나중에" variant="outline" onPress={onClose} disabled={save.isPending} style={styles.action} />
            <Button
              label="남기기"
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
  // 묶음 사이는 lg, 묶음 안은 xs~sm — 축하 · 카드 · 버튼 세 덩어리가 간격만으로 읽히게.
  content: { gap: spacing.lg },
  head: { gap: spacing.xs },
  center: { textAlign: 'center' },
  cardBlock: { gap: spacing.sm },
  quoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  // 여는 따옴표는 장식 — 입력칸 첫 줄 높이에 맞춘다(칸 위 여백 sm + 줄높이 22 의 가운데).
  quoteMark: { fontFamily: serif.regular, fontSize: 22, lineHeight: 30, marginTop: 2 },
  input: {
    flex: 1,
    // 60자면 카드 폭에서 서너 줄 — 처음부터 세 줄 자리(22×3 + 위아래 여백)를 둔다. 웹 칸은 저절로 늘지 않아
    // 두 줄 자리면 쓰는 도중에 칸 안에서 스크롤된다. 네이티브는 넘치면 maxHeight 까지 늘어난다.
    minHeight: 82,
    maxHeight: 120,
    borderWidth: hairline,
    // 한 줄평 칸(RemarkField · Field)과 같은 입력 모서리.
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: serif.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  footer: { gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
