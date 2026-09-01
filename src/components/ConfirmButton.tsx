import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 2탭 확인 버튼 — 1탭에 질문 + [확정][취소]로 전환되고, 확정 시 onConfirm을 실행한다.
 * pending이 true→false로 떨어지면(성공·실패 무관) 자동으로 원래 버튼으로 복귀한다.
 * 실패 안내 캡션은 호출부가 뮤테이션 상태로 표시한다.
 */
export function ConfirmButton({ label, question, confirmLabel = '확정', tone = 'accent', variant = 'outline', pending = false, onConfirm }: {
  label: string;
  question: string;
  confirmLabel?: string;
  /** 확정 버튼 색 — accent(완독 등) | danger(하차 등) */
  tone?: 'accent' | 'danger';
  /** 대기 상태 버튼 모양 */
  variant?: 'outline' | 'ghost';
  pending?: boolean;
  onConfirm: () => void;
}) {
  const { colors } = useTheme();
  const [arming, setArming] = useState(false);
  const [wasPending, setWasPending] = useState(false);

  useEffect(() => {
    if (pending) {
      setWasPending(true);
    } else if (wasPending) {
      setArming(false);
      setWasPending(false);
    }
  }, [pending, wasPending]);

  if (arming) {
    const confirmBg = tone === 'danger' ? colors.danger : colors.accent;
    const confirmFg = tone === 'danger' ? colors.bg : colors.onAccent;
    return (
      <View style={styles.row}>
        <Text style={[typeScale.caption, { color: colors.textMuted, flex: 1 }]}>{question}</Text>
        <Pressable
          disabled={pending}
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          style={[styles.button, { backgroundColor: confirmBg, opacity: pending ? 0.6 : 1 }]}
        >
          <Text style={[typeScale.label, { color: confirmFg }]}>
            {pending ? '처리 중…' : confirmLabel}
          </Text>
        </Pressable>
        <Pressable
          disabled={pending}
          onPress={() => setArming(false)}
          accessibilityRole="button"
          accessibilityLabel="취소"
          style={[styles.button, { borderWidth: 1, borderColor: colors.lineStrong }]}
        >
          <Text style={[typeScale.label, { color: colors.textMuted }]}>취소</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setArming(true)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        styles.idle,
        variant === 'outline' ? { borderWidth: 1, borderColor: colors.lineStrong } : null,
      ]}
    >
      <Text style={[typeScale.label, { color: variant === 'ghost' ? colors.textFaint : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  idle: { alignSelf: 'stretch' },
});
