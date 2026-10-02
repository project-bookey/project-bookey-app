import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BookQuote } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { spacing, typeScale, useTheme } from '@/theme';

/**
 * 밑줄 조각 — 점선 메모 안 문장 + 모노 한 줄(책 제목 · N쪽).
 * 좋아요·댓글 수는 조각에 두지 않는다 — 조각은 문장이 먼저 읽히게, 나머지는 상세에서 본다
 * (docs/superpowers/specs/2026-09-03-review-comments-design.md 의 결정).
 * 도서 상세 밑줄 탭(책이 하나라 제목은 끈다)과 내가 오려둔 문장 목록(여러 책이 섞여 제목을 켠다)이 같이 쓴다.
 * `onPress` 가 있으면 조각을 눌러 상세로 간다.
 */
export function QuoteScrap({
  quote,
  rotate,
  onPress,
  showBook = true,
}: {
  quote: BookQuote;
  /** 기울기(도) — 목록은 index 에 따라 ±1 로 교차. */
  rotate: number;
  onPress?: () => void;
  /** 메타 줄 맨 앞의 책 제목 — 한 책만 보는 도서 상세에서는 끈다. */
  showBook?: boolean;
}) {
  const { colors } = useTheme();
  // 메타 한 줄 — 책 제목·쪽수 중 있는 것만 ' · ' 로 잇는다. 하나도 없으면 줄 자체를 두지 않는다.
  const meta = [
    showBook ? quote.bookTitle : null,
    quote.page != null ? `${quote.page}쪽` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const scrap = (
    <MemoScrap rotate={rotate}>
      <Text style={[styles.text, { color: colors.text, borderLeftColor: colors.accent }]}>
        {quote.content}
      </Text>
      {meta ? (
        <Text numberOfLines={1} style={[typeScale.monoLabel, styles.meta, { color: colors.textMuted }]}>
          {meta}
        </Text>
      ) : null}
    </MemoScrap>
  );

  return (
    <View style={styles.row}>
      {onPress ? (
        <Pressable style={styles.scrap} onPress={onPress} accessibilityRole="button" accessibilityLabel="밑줄 상세">
          {scrap}
        </Pressable>
      ) : (
        <View style={styles.scrap} accessible accessibilityRole="text">
          {scrap}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  scrap: { flex: 1 },
  // 인용 본문 — 밑줄 카드와 같은 만듦새로, quote 토큰을 14/1.7 로 줄이고 왼쪽에 악센트 선을 세운다.
  text: { ...typeScale.quote, fontSize: 14, lineHeight: 24, borderLeftWidth: 2, paddingLeft: 11 },
  // 메타 줄 — 도서 상세가 쓰던 쪽수 줄과 같은 값(9px 모노, 위 여백 sm).
  meta: { fontSize: 9, letterSpacing: 0.4, marginTop: spacing.sm },
});
