import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BookQuote } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { spacing, typeScale, useTheme } from '@/theme';

/**
 * 밑줄 조각 — 점선 메모 안 문장 + 모노 메타(책 제목 · 작성자 · 쪽 · 나도 그럼 · 댓글).
 * 도서 상세 밑줄 탭(책이 하나라 제목은 끈다)과 독후감의 밑줄 고르기·붙이기(여러 책이 섞인다)가 같이 쓴다.
 * `onPress` 가 있으면 통째로 눌러 상세로 가고, `selected` 면 테두리를 악센트로 세워 고른 상태를 보인다.
 */
export function QuoteScrap({ quote, rotate, onPress, trailing, selected, showBook = true }: {
  quote: BookQuote;
  /** 기울기(도) — 목록은 index 에 따라 ±1 로 교차. */
  rotate: number;
  onPress?: () => void;
  /** 메타 줄 오른쪽 끝 슬롯. */
  trailing?: ReactNode;
  /** 고른 상태 — 테두리 악센트 + accessibilityState.selected. */
  selected?: boolean;
  /** 메타 맨 앞의 책 제목 — 한 책만 보는 도서 상세에서는 끈다. */
  showBook?: boolean;
}) {
  const { colors } = useTheme();

  const scrap = (
    <MemoScrap rotate={rotate} style={selected ? { borderColor: colors.accent } : undefined}>
      <Text style={[styles.text, { color: colors.text, borderLeftColor: colors.accent }]}>
        {quote.content}
      </Text>
      <View style={styles.meta}>
        <Text numberOfLines={1} style={[typeScale.monoLabel, styles.metaText, styles.who, { color: colors.textMuted }]}>
          {showBook ? `${quote.bookTitle} · ` : ''}
          {quote.authorNickname}
          {quote.page != null ? ` · ${quote.page}쪽` : ''}
        </Text>
        <Text style={[typeScale.monoLabel, styles.metaText, {
          color: quote.agreedByMe ? colors.accent : colors.textFaint,
        }]}>
          나도 그럼 {quote.agreeCount}
        </Text>
        <Text style={[typeScale.monoLabel, styles.metaText, { color: colors.accent }]}>
          댓글 {quote.commentCount}
        </Text>
        {trailing}
      </View>
    </MemoScrap>
  );

  if (!onPress) return scrap;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="밑줄 상세"
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      {scrap}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 인용 본문 — 밑줄 카드와 같은 만듦새로, quote 토큰을 14/1.7 로 줄이고 왼쪽에 악센트 선을 세운다.
  text: { ...typeScale.quote, fontSize: 14, lineHeight: 24, borderLeftWidth: 2, paddingLeft: 11 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  metaText: { fontSize: 9, letterSpacing: 0.4 },
  who: { flex: 1 },
});
