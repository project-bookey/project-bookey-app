import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { formatRelative } from '@/components/ui';
import { hairline, radius, spacing, typeScale, useTheme } from '@/theme';

import type { ThreadComment } from './types';

/**
 * 스레드 한 줄 — 아바타 · 닉네임 · 본문 · 상대 시각 · 답글 달기 · (본인) 삭제.
 *
 * 최상위 댓글과 답글이 같은 줄을 쓴다. 답글은 `onToggleReplies`·`onPressReply` 없이 그려서
 * 답글의 답글이 생기지 않게 한다(스레드는 두 단계까지).
 *
 * variant — 'card'(최상위, 기본)는 줄 전체(와 펼친 답글)를 카드 박스로 감싼다.
 * 'reply'(답글)는 박스 없이 부모 카드 안에서 얕게 들여쓴 줄로만 그린다(아바타도 20px로 줄인다).
 */
export function CommentRow({
  comment, confirming, error, expanded = false, variant = 'card', onDelete, onToggleReplies, onPressReply, children,
}: {
  comment: ThreadComment;
  confirming: boolean;
  error: string | null;
  expanded?: boolean;
  variant?: 'card' | 'reply';
  onDelete: () => void;
  /** 접기 컨트롤 — 최상위 줄에만 넘어온다. */
  onToggleReplies?: () => void;
  /** 답글 달기 — 최상위 줄에만 넘어온다. */
  onPressReply?: () => void;
  /** 펼친 답글 목록. */
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const isReply = variant === 'reply';
  // 텍스트가 곧 상태다 — 접힘/펼침을 따로 표시하지 않고 다음 동작을 그대로 읽힌다.
  const foldLabel = expanded ? '답글 접기' : `답글 ${comment.replyCount}개 보기`;

  return (
    <View style={isReply ? undefined : [styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={[styles.row, isReply && styles.rowReply]}>
        <QuoteAvatar
          uri={comment.authorAvatarUrl}
          nickname={comment.authorNickname}
          size={isReply ? 20 : 24}
        />
        <View style={styles.rowBody}>
          <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
            {comment.authorNickname}
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>{comment.body}</Text>
          <View style={styles.metaRow}>
            <Text style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>
              {formatRelative(comment.createdAt)}
            </Text>
            {onPressReply ? (
              <Pressable onPress={onPressReply} hitSlop={10} accessibilityRole="button"
                accessibilityLabel="답글 달기">
                <Text style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>답글 달기</Text>
              </Pressable>
            ) : null}
            {comment.mine ? (
              <Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button"
                accessibilityLabel={confirming ? '삭제 확인' : '삭제'}>
                <Text style={[typeScale.monoLabel, styles.meta, {
                  color: confirming ? colors.danger : colors.textFaint,
                }]}>
                  {confirming ? '한 번 더' : '삭제'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {error ? <Text style={[typeScale.caption, { color: colors.warn }]}>{error}</Text> : null}
          {comment.replyCount > 0 && onToggleReplies ? (
            <Pressable onPress={onToggleReplies} hitSlop={8} accessibilityRole="button"
              accessibilityLabel={foldLabel} style={styles.fold}>
              <Text style={[typeScale.monoLabel, styles.meta, { color: colors.accent }]}>{foldLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {children ? (
        <View style={[styles.replies, { borderLeftColor: colors.line }]}>{children}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: hairline,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowReply: { gap: 8 },
  rowBody: { flex: 1, gap: 2 },
  nickname: { fontSize: 12 },
  body: { ...typeScale.body, fontSize: 13, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  meta: { fontSize: 9, letterSpacing: 0.4 },
  fold: { alignSelf: 'flex-start', marginTop: spacing.xs },
  // 얕은 들여쓰기 — 부모 아바타 열 안쪽으로 살짝만 밀어 넣는다(사용자 결정 A1).
  // 카드 박스 안이라 부모 본문 왼쪽 끝까지 맞출 필요가 없다.
  replies: {
    marginTop: spacing.sm,
    marginLeft: 12,
    paddingLeft: 10,
    borderLeftWidth: 2,
    gap: spacing.sm,
  },
});
