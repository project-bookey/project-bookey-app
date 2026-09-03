import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BookQuote } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { spacing, typeScale, useTheme } from '@/theme';

/**
 * 밑줄 조각 — 점선 메모 안 문장 + 모노 메타(책 제목 · 작성자 · 쪽 · 나도 그럼 · 댓글).
 * 도서 상세 밑줄 탭(책이 하나라 제목은 끈다)과 독후감의 밑줄 고르기·붙이기(여러 책이 섞인다)가 같이 쓴다.
 * `onPress` 가 있으면 조각을 눌러 상세로 가고, `selected` 면 테두리를 악센트로 세워 고른 상태를 보인다.
 */
export function QuoteScrap({ quote, rotate, onPress, trailing, selected, showBook = true }: {
  quote: BookQuote;
  /** 기울기(도) — 목록은 index 에 따라 ±1 로 교차. */
  rotate: number;
  onPress?: () => void;
  /**
   * 조각 오른쪽 슬롯(예: '떼기') — 조각을 누르는 Pressable 의 형제라
   * 웹에서 버튼이 겹치지 않는다. 없으면 조각만 있을 때와 레이아웃이 같다.
   */
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
      </View>
    </MemoScrap>
  );

  // 고른 상태는 누를 수 없는 조각(붙여 둔 밑줄)에서도 읽혀야 하므로 감싸는 줄이 든다.
  return (
    <View style={styles.row} accessibilityState={selected === undefined ? undefined : { selected }}>
      {onPress ? (
        <Pressable style={styles.scrap} onPress={onPress} accessibilityRole="button" accessibilityLabel="밑줄 상세">
          {scrap}
        </Pressable>
      ) : (
        <View style={styles.scrap}>{scrap}</View>
      )}
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  // 조각과 trailing 을 나란히 — trailing 이 없으면 조각이 폭을 다 차지해 예전과 같은 모양이 된다.
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scrap: { flex: 1 },
  // 인용 본문 — 밑줄 카드와 같은 만듦새로, quote 토큰을 14/1.7 로 줄이고 왼쪽에 악센트 선을 세운다.
  text: { ...typeScale.quote, fontSize: 14, lineHeight: 24, borderLeftWidth: 2, paddingLeft: 11 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  metaText: { fontSize: 9, letterSpacing: 0.4 },
  who: { flex: 1 },
});
