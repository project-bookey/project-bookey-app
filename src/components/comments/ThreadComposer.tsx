import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { hairline, layout, radius, spacing, typeScale, useTheme } from '@/theme';

import { BODY_MAX } from './types';
import type { ReplyTarget } from './types';

/**
 * 하단 고정 입력 바 — 비어 있거나 보내는 중이면 '남기기'가 죽는다.
 *
 * 보내는 일은 스레드(onSubmit)가 하고, 여기서는 쓰던 글·전송 중·실패 문구만 가진다.
 * 성공했을 때만 입력을 비우므로 실패해도 쓰던 글이 남아 다시 누를 수 있다.
 * 답글 대상이 있으면 입력 위에 칩이 붙어 키보드와 함께 올라온다.
 */
export const ThreadComposer = forwardRef<TextInput, {
  placeholder: string;
  replyTo: ReplyTarget | null;
  onCancelReply: () => void;
  onSubmit: (body: string) => Promise<unknown>;
}>(function ThreadComposer({ placeholder, replyTo, onCancelReply, onSubmit }, ref) {
  const { colors } = useTheme();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= BODY_MAX;
  const disabled = !canSubmit || sending;

  const submit = async () => {
    if (disabled) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setBody('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '남기지 못했어요 · 다시 시도');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.bar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
      {replyTo ? (
        <View style={[styles.replyChip, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
          <Text numberOfLines={1} style={[typeScale.monoLabel, styles.replyChipText, { color: colors.accent }]}>
            {replyTo.nickname}님에게 답글
          </Text>
          <Pressable onPress={onCancelReply} hitSlop={10} accessibilityRole="button"
            accessibilityLabel="답글 취소">
            <Text style={[typeScale.monoLabel, { color: colors.accent }]}>✕</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.barRow}>
        <TextInput
          ref={ref}
          value={body}
          onChangeText={setBody}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={BODY_MAX}
          accessibilityLabel="댓글"
          style={[styles.input, {
            backgroundColor: colors.surfaceDeep, borderColor: colors.line, color: colors.text,
          }]}
        />
        <Pressable
          onPress={submit}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={sending ? '남기는 중' : replyTo ? '답글 남기기' : '댓글 남기기'}
          accessibilityState={{ disabled }}
          style={[styles.send, { backgroundColor: colors.accent, opacity: disabled ? 0.35 : 1 }]}
        >
          <Text style={[typeScale.monoLabel, { color: colors.onAccent }]}>
            {sending ? '남기는 중…' : '남기기'}
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text style={[typeScale.caption, styles.barError, { color: colors.warn }]}>{error}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { ...layout.content, borderTopWidth: hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: hairline,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  replyChipText: { flexShrink: 1 },
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
