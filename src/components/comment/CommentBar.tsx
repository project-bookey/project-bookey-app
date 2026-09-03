import type { Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

/** 댓글 길이 상한 — 서버 계약과 같은 값(밑줄 댓글·독후감 댓글 공통). */
export const COMMENT_BODY_MAX = 300;

/**
 * 하단 고정 댓글 입력 바 — 제어형. 입력·남기기 버튼·에러 표시만 맡고 뮤테이션은 화면이 든다.
 * 비어 있거나 전송 중이면 '남기기'가 죽는다. `replyTo` 가 있으면 입력 위에 답글 대상 한 줄이 선다.
 */
export function CommentBar({
  value, onChange, placeholder, canSubmit, pending, error, onSubmit, replyTo, onCancelReply, inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  canSubmit: boolean;
  pending: boolean;
  /** 남기기 실패 안내 — 바 아래 한 줄. */
  error: string | null;
  onSubmit: () => void;
  /** 답글 대상 — 있으면 `↳ {nickname}에게 답글 · 취소` 줄. */
  replyTo?: { nickname: string };
  onCancelReply?: () => void;
  /** 답글을 누르면 화면이 입력 칸에 포커스를 주기 위해. */
  inputRef?: Ref<TextInput>;
}) {
  const { colors } = useTheme();
  const disabled = !canSubmit || pending;

  return (
    <View style={[styles.bar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
      {replyTo ? (
        <View style={styles.replyRow}>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.replyText, { color: colors.textMuted }]}>
            ↳ {replyTo.nickname}에게 답글 ·
          </Text>
          <Pressable onPress={onCancelReply} hitSlop={8} accessibilityRole="button" accessibilityLabel="답글 취소">
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>취소</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.barRow}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={COMMENT_BODY_MAX}
          accessibilityLabel="댓글"
          style={[styles.input, {
            backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
          }]}
        />
        <Pressable
          onPress={onSubmit}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={pending ? '남기는 중' : '댓글 남기기'}
          accessibilityState={{ disabled }}
          style={[styles.send, { backgroundColor: colors.accent, opacity: disabled ? 0.35 : 1 }]}
        >
          <Text style={[typeScale.monoLabel, { color: colors.onAccent }]}>
            {pending ? '남기는 중…' : '남기기'}
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text style={[typeScale.caption, styles.barError, { color: colors.warn }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { ...layout.content, borderTopWidth: hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  replyText: { flexShrink: 1 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: hairline,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typeScale.body,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  send: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 3 },
  barError: { marginTop: spacing.xs },
});
