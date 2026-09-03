import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { formatRelative } from '@/components/ui';
import { hairline, spacing, typeScale, useTheme } from '@/theme';

import type { ThreadComment } from './types';

/**
 * 스레드 한 줄 — 아바타 · 닉네임 · 본문 · 상대 시각 · 답글 달기 · (본인) 삭제.
 *
 * 최상위 댓글과 답글이 같은 줄을 쓴다. 답글은 `onToggleReplies`·`onPressReply` 없이 그려서
 * 답글의 답글이 생기지 않게 한다(스레드는 두 단계까지).
 */
export function CommentRow({
  comment, confirming, error, expanded = false, onDelete, onToggleReplies, onPressReply, children,
}: {
  comment: ThreadComment;
  confirming: boolean;
  error: string | null;
  expanded?: boolean;
  onDelete: () => void;
  /** 접기 컨트롤 — 최상위 줄에만 넘어온다. */
  onToggleReplies?: () => void;
  /** 답글 달기 — 최상위 줄에만 넘어온다. */
  onPressReply?: () => void;
  /** 펼친 답글 목록. */
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  // 텍스트가 곧 상태다 — 접힘/펼침을 따로 표시하지 않고 다음 동작을 그대로 읽힌다.
  const foldLabel = expanded ? '답글 접기' : `답글 ${comment.replyCount}개 보기`;

  return (
    <View>
      <View style={styles.row}>
        <QuoteAvatar uri={comment.authorAvatarUrl} nickname={comment.authorNickname} />
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
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowBody: { flex: 1, gap: 2 },
  nickname: { fontSize: 12 },
  body: { ...typeScale.body, fontSize: 13, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  meta: { fontSize: 9, letterSpacing: 0.4 },
  fold: { alignSelf: 'flex-start', marginTop: spacing.xs },
  // 34 = 아바타 24 + 아바타·본문 사이 10 — 답글 줄이 부모 본문 왼쪽 끝에 맞춰 선다.
  replies: {
    marginTop: spacing.sm,
    marginLeft: 34,
    paddingLeft: spacing.md,
    borderLeftWidth: hairline,
    gap: spacing.md,
  },
});
