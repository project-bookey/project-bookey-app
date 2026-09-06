import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BookQuote } from '@/api/types';
import { MemoScrap } from '@/components/collage';
import { spacing, typeScale, useTheme } from '@/theme';

/**
 * 밑줄 조각 — 점선 메모 안 문장 + 모노 한 줄(책 제목 · N쪽).
 * 좋아요·댓글 수는 조각에 두지 않는다 — 조각은 문장이 먼저 읽히게, 나머지는 상세에서 본다
 * (docs/superpowers/specs/2026-09-03-review-comments-design.md 의 결정).
 * 작성자도 기본으로는 숨기고, 여러 사람의 문장이 섞이는 자리에서만 `showAuthor` 로 켠다.
 * 도서 상세 밑줄 탭(책이 하나라 제목은 끈다)과 독후감의 밑줄 고르기·붙이기(여러 책이 섞여 제목을 켠다)가 같이 쓴다.
 * `onPress` 가 있으면 조각을 눌러 상세로 가고, `selected` 면 테두리를 악센트로 세워 고른 상태를 보인다.
 */
export function QuoteScrap({
  quote,
  rotate,
  onPress,
  trailing,
  selected,
  showBook = true,
  showAuthor = false,
  accessibilityRole = 'button',
  accessibilityLabel = '밑줄 상세',
  disabled,
}: {
  quote: BookQuote;
  /** 기울기(도) — 목록은 index 에 따라 ±1 로 교차. */
  rotate: number;
  onPress?: () => void;
  /**
   * 조각 오른쪽 슬롯(예: '떼기') — 조각을 누르는 Pressable 의 형제라
   * 웹에서 버튼이 겹치지 않는다. 없으면 조각만 있을 때와 레이아웃이 같다.
   */
  trailing?: ReactNode;
  /** 고른 상태 — 테두리 악센트 + 역할에 맞는 접근성 상태(checkbox 는 checked, 그 밖은 selected). */
  selected?: boolean;
  /** 메타 줄 맨 앞의 책 제목 — 한 책만 보는 도서 상세에서는 끈다. */
  showBook?: boolean;
  /** 남의 문장이면 메타 맨 앞에 작성자를 밝힌다 — 독후감처럼 여러 사람의 문장이 섞이는 자리에서 켠다. */
  showAuthor?: boolean;
  /** 누를 때의 역할 — 상세로 가면 'button', 골랐다 풀었다 하는 목록에서는 'checkbox'. */
  accessibilityRole?: 'button' | 'checkbox';
  /** 누를 때의 라벨. */
  accessibilityLabel?: string;
  /** 누르기를 막는다(고를 수 있는 장수를 다 쓴 경우 등). */
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  // 메타 한 줄 — 작성자(남의 것일 때만)·책 제목·쪽수 중 있는 것만 ' · ' 로 잇는다.
  // 하나도 없으면 줄 자체를 두지 않는다.
  const meta = [
    showAuthor && !quote.mine ? `${quote.authorNickname}님` : null,
    showBook ? quote.bookTitle : null,
    quote.page != null ? `${quote.page}쪽` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const scrap = (
    <MemoScrap rotate={rotate} style={selected ? { borderColor: colors.accent } : undefined}>
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

  // 접근성 상태는 역할을 가진 요소에만 붙는다 — 역할 없는 View 에 얹으면 무효 ARIA 다.
  // checkbox 는 aria-selected 를 받지 않으므로 checked 로 바꿔 준다.
  const pressedState =
    selected === undefined ? undefined : accessibilityRole === 'checkbox' ? { checked: selected } : { selected };

  return (
    <View style={styles.row}>
      {onPress ? (
        <Pressable
          style={styles.scrap}
          onPress={onPress}
          disabled={disabled}
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={pressedState}
        >
          {scrap}
        </Pressable>
      ) : (
        // 누를 수 없는 조각(붙여 둔 밑줄)도 고른 상태가 읽혀야 한다 — 한 덩어리 텍스트로 묶어 역할을 준다.
        <View
          style={styles.scrap}
          accessible
          accessibilityRole="text"
          accessibilityState={selected === undefined ? undefined : { selected }}
        >
          {scrap}
        </View>
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
  // 메타 줄 — 도서 상세가 쓰던 쪽수 줄과 같은 값(9px 모노, 위 여백 sm).
  meta: { fontSize: 9, letterSpacing: 0.4, marginTop: spacing.sm },
});
