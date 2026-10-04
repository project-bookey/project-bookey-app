import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { TiltCover } from '@/components/collage';
import { NoteSheet } from '@/components/note/NoteSheet';
import { RemarkField } from '@/components/remark/RemarkField';
import { Button } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/theme';
import { hairline, serif } from '@/theme/tokens';

import { RATING_WORDS, StarRating, ratingPrompt } from './StarRating';

/** 완독 시트에 띄울 책 — 표지·제목과 읽은 기간·시간 한 줄. */
export type FinishedBook = {
  title: string;
  coverUrl?: string | null;
  /** '9.12 → 10.4 · 6시간 20분' — 모르면 없다. */
  meta?: string;
};

/** 완독 시트의 첫 단계 — 책을 덮으며 한 마디. 글·저장 상태는 부모가 쥔다. */
export type RemarkStep = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** 다음 단계(리뷰)로 넘기거나, 다음 단계가 없으면 닫는다. */
  onSkip: () => void;
  /** 다음 단계가 있으면 '건너뛰기', 없으면 '나중에'. */
  skipLabel: string;
  pending: boolean;
  error: string | null;
};

/** 시트 머리 — 표지와 한 마디 인사, 제목, 읽은 기간. 한 묶음이라 안쪽 간격은 좁게. 하차 시트도 같은 머리를 쓴다. */
export function ClosingBookHead({ book, heading }: { book: FinishedBook; heading: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.head}>
      <TiltCover uri={book.coverUrl} title={book.title} width={56} tilt={-3} entering={false} />
      <View style={styles.headText}>
        <Text style={[typeScale.titleSerif, { color: colors.text }]}>{heading}</Text>
        <Text numberOfLines={2} style={[typeScale.label, { color: colors.textMuted }]}>{book.title}</Text>
        {book.meta ? (
          <Text numberOfLines={1} style={[typeScale.monoLabel, { color: colors.textFaint }]}>{book.meta}</Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * 완독 시트 — 책을 다 읽은 그 순간에 아래에서 올라온다. 두 단계를 한 시트에서 차례로 묻는다(UX 철칙 Hick).
 *
 * ① 한 마디(remarkStep 이 있을 때): 책을 덮으며 남기는 한 줄. 이 책 페이지에서 다른 독자들에게 돌아가며 보인다.
 * ② 리뷰: 별점 먼저 — 별 하나 누르기가 글 쓰기보다 가벼워 시작이 쉽다. 별을 고르면 그 별에 맞춘 질문을 단 글 칸이
 * 펼쳐지고 바로 쓸 수 있게 포커스가 간다(처음 한 번만 — 별을 바꿀 때마다 키보드가 튀지 않게).
 * 별점·글 상태는 부모가 쥔다 — 시트를 닫아도 쓰던 글은 도서 상세의 리뷰 폼으로 그대로 이어진다.
 */
export function FinishReviewSheet({
  book, rating, onRating, body, onBody, onSubmit, onClose, pending, error, remarkStep,
}: {
  book: FinishedBook;
  rating: number;
  onRating: (rating: number) => void;
  body: string;
  onBody: (body: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  pending: boolean;
  error: string | null;
  /** 있으면 리뷰 대신 한 마디 단계를 그린다. */
  remarkStep?: RemarkStep | null;
}) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  // 글 칸은 별을 고른 뒤에 연다 — 이미 쓴 글이 있으면(별을 다시 비웠어도) 계속 보여 준다.
  const writing = rating > 0 || body.length > 0;

  const pickRating = (next: number) => {
    const first = !writing && next > 0;
    onRating(next);
    // 칸이 그려진 다음 프레임에 포커스 — 마운트 전이라 ref 가 비어 있다.
    if (first) requestAnimationFrame(() => inputRef.current?.focus());
  };

  if (remarkStep) {
    return (
      <NoteSheet visible title="완독" onClose={onClose} scroll>
        <View style={styles.content}>
          <ClosingBookHead book={book} heading="다 읽었어요" />
          <RemarkField value={remarkStep.value} onChange={remarkStep.onChange} kind="FINISHED" />
          <View style={styles.footer}>
            {remarkStep.error ? (
              <Text style={[typeScale.caption, { color: colors.danger }]}>{remarkStep.error}</Text>
            ) : null}
            <View style={styles.actions}>
              <Button
                label={remarkStep.skipLabel}
                variant="outline"
                onPress={remarkStep.onSkip}
                disabled={remarkStep.pending}
                style={styles.action}
              />
              <Button
                label="남기기"
                onPress={remarkStep.onSubmit}
                loading={remarkStep.pending}
                disabled={remarkStep.value.trim().length === 0}
                style={styles.action}
              />
            </View>
          </View>
        </View>
      </NoteSheet>
    );
  }

  return (
    <NoteSheet visible title="완독" onClose={onClose} scroll>
      <View style={styles.content}>
        {/* ① 축하 — 표지와 제목, 읽은 기간. */}
        <ClosingBookHead book={book} heading="다 읽었어요" />

        {/* ② 별점 — 시트의 주인공. 고른 별 밑에 한마디가 따라온다. */}
        <View style={styles.rate}>
          <StarRating value={rating} onChange={pickRating} size="lg" />
          <Text style={[typeScale.caption, { color: rating > 0 ? colors.text : colors.textFaint }]}>
            {rating > 0 ? RATING_WORDS[rating] : '별을 눌러 남겨 보세요'}
          </Text>
        </View>

        {/* ③ 한 줄 — 별을 고르면 펼쳐진다. 질문은 고른 별에 맞춰 바뀐다. */}
        {writing ? (
          <TextInput
            ref={inputRef}
            value={body}
            onChangeText={onBody}
            placeholder={ratingPrompt(rating)}
            placeholderTextColor={colors.textFaint}
            multiline
            accessibilityLabel="리뷰"
            style={[styles.input, {
              backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
            }]}
          />
        ) : null}

        {/* 실패 안내는 버튼 바로 위에 붙인다(Proximity). */}
        <View style={styles.footer}>
          {error ? <Text style={[typeScale.caption, { color: colors.danger }]}>{error}</Text> : null}
          {/* 앱 전체 순서 — [취소][주요 버튼]. 짧은 글이라 '남기기'. */}
          <View style={styles.actions}>
            <Button label="나중에" variant="outline" onPress={onClose} disabled={pending} style={styles.action} />
            <Button
              label="남기기"
              onPress={onSubmit}
              loading={pending}
              disabled={body.trim().length === 0}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </NoteSheet>
  );
}

const styles = StyleSheet.create({
  // 묶음 사이는 lg, 묶음 안은 xs~sm — 간격만으로 세 덩어리가 읽히게.
  content: { gap: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headText: { flex: 1, gap: spacing.xs },
  rate: { alignItems: 'center', gap: spacing.xs },
  input: {
    minHeight: 88,
    maxHeight: 160, // 길어지면 칸 안에서 스크롤 — '남기기'가 키보드 밑으로 밀려나지 않게
    borderRadius: radius.md,
    borderWidth: hairline,
    padding: spacing.md,
    fontFamily: serif.regular,
    fontSize: 15,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  footer: { gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
