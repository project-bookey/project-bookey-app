import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { MemoScrap } from '@/components/collage';
import { useKeyboardReveal } from '@/components/keyboard';
import { Button } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/theme';
import { serif } from '@/theme/tokens';

import { RATING_WORDS, StarRating, ratingPrompt } from './StarRating';

/**
 * 리뷰 쓰는 칸 — 도서 상세에서 새로 남길 때와 리뷰 상세에서 고칠 때 같은 모양을 쓴다.
 * 목록의 리뷰 조각(ReviewScrap)과 같은 머리(이름·별)·본문 자리에 선다. 안쪽 입력 상자는 두지 않는다(이중 테두리).
 * 쓰는 중인 조각만 테두리를 한 단 짙게 해 구분한다. 버튼 줄은 조각 밖 바로 아래 — [취소][주요 버튼].
 * KeyboardScroll 안에 둔다: 글 칸을 누르면 그 밑 버튼 줄까지 키보드 위로 올린다.
 */
export function ReviewForm({
  nickname, rating, onRating, body, onBody, submitLabel, onSubmit, onCancel, pending, error,
}: {
  nickname: string;
  rating: number;
  onRating: (rating: number) => void;
  body: string;
  onBody: (body: string) => void;
  /** 처음 남길 땐 '남기기', 고칠 땐 '저장'(제출 라벨 규칙). */
  submitLabel: '남기기' | '저장';
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  error?: string | null;
}) {
  const { colors } = useTheme();
  const reveal = useKeyboardReveal();
  const actionsRef = useRef<View>(null);

  return (
    <View style={styles.block}>
      <MemoScrap rotate={0} style={{ borderColor: colors.textFaint }}>
        <View style={styles.head}>
          <Text numberOfLines={1} style={[typeScale.label, styles.author, { color: colors.text }]}>
            {nickname}
          </Text>
          <View style={styles.stars}>
            <StarRating value={rating} onChange={onRating} />
          </View>
        </View>
        <TextInput
          value={body}
          onChangeText={onBody}
          placeholder={ratingPrompt(rating)}
          placeholderTextColor={colors.textFaint}
          multiline
          accessibilityLabel="리뷰"
          onFocus={() => reveal(actionsRef)}
          onContentSizeChange={() => reveal(actionsRef, { onlyIfOpen: true })}
          style={[styles.input, { color: colors.text }]}
        />
        <Text style={[typeScale.caption, styles.meta, { color: rating > 0 ? colors.text : colors.textFaint }]}>
          {rating > 0 ? RATING_WORDS[rating] : '별점은 선택이에요'}
        </Text>
      </MemoScrap>
      {error ? <Text style={[typeScale.caption, { color: colors.warn }]}>{error}</Text> : null}
      <View ref={actionsRef} style={styles.actions}>
        <Button label="취소" variant="outline" onPress={onCancel} disabled={pending} style={styles.button} />
        <Button
          label={submitLabel}
          onPress={onSubmit}
          loading={pending}
          disabled={body.trim().length === 0}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  author: { flexShrink: 1 },
  // 별 상자(44pt)의 오른쪽 여백만큼 당겨 별이 조각 안쪽 가장자리에 맞게 — 위아래도 상자만큼 되돌려 머리 줄 높이는 그대로.
  stars: { marginRight: -spacing.sm, marginVertical: -spacing.sm },
  input: {
    minHeight: 72,
    maxHeight: 160, // 길어지면 칸 안에서 스크롤 — 버튼 줄이 키보드 밑으로 밀려나지 않게
    marginTop: spacing.sm,
    padding: 0,
    fontFamily: serif.regular,
    fontSize: 15,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  meta: { alignSelf: 'flex-end', marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1 },
});
