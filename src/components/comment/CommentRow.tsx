import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QuoteAvatar } from '@/components/quote/QuoteCard';
import { FootAction, formatRelative } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/theme';

/** 답글 들여쓰기 — 아바타 24 + 간격 10. 본문이 부모 댓글의 본문 선에서 시작한다. */
const REPLY_INDENT = 34;

/**
 * 댓글 한 줄 — 아바타 이니셜 · 닉네임 · 본문 · 상대 시각 · (답글) · (본인) 삭제.
 * 밑줄 상세와 독후감 상세가 같이 쓴다. 삭제는 두 번 눌러야 나가므로 `confirming` 이면 라벨이 `confirmLabel` 로 바뀐다.
 */
export function CommentRow({
  nickname, avatarUrl, body, createdAt, mine, confirming, confirmLabel = '한 번 더', error, onDelete, onReply, indent,
}: {
  nickname: string;
  avatarUrl?: string | null;
  body: string;
  createdAt: string;
  mine: boolean;
  /** 삭제 재확인 상태 — 라벨이 confirmLabel 로 바뀐다. */
  confirming: boolean;
  confirmLabel?: string;
  /** 삭제 실패 안내 — 이 행에서 실패했을 때만 들어온다. */
  error: string | null;
  onDelete: () => void;
  /** 있으면 메타 줄에 `답글` — 한 단계 답글을 받는 댓글에서만. */
  onReply?: () => void;
  /** 답글이면 들여쓴다(아바타 폭 + 간격). */
  indent?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, indent ? styles.indent : null]}>
      <QuoteAvatar uri={avatarUrl} nickname={nickname} />
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={[typeScale.bodyStrong, styles.nickname, { color: colors.text }]}>
          {nickname}
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{body}</Text>
        <View style={styles.metaRow}>
          <Text style={[typeScale.monoLabel, styles.meta, { color: colors.textFaint }]}>
            {formatRelative(createdAt)}
          </Text>
          {/* 웹은 hitSlop 을 무시하므로 여백으로 상자를 키우는 FootAction 으로 누른다. */}
          {onReply ? (
            <FootAction label="답글" onPress={onReply} tone="muted" accessibilityLabel={`${nickname}에게 답글`} />
          ) : null}
          {mine ? (
            <Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button"
              accessibilityLabel={confirming ? '삭제 확인' : '삭제'}>
              <Text style={[typeScale.monoLabel, styles.meta, {
                color: confirming ? colors.danger : colors.textFaint,
              }]}>
                {confirming ? confirmLabel : '삭제'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {error ? <Text style={[typeScale.caption, { color: colors.warn }]}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  indent: { paddingLeft: REPLY_INDENT },
  rowBody: { flex: 1, gap: 2 },
  nickname: { fontSize: 12 },
  body: { ...typeScale.body, fontSize: 13, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  meta: { fontSize: 9, letterSpacing: 0.4 },
});
