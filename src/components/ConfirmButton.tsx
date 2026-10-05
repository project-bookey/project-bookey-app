import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { controlHeight, controlFace, pressedStyle, radius, spacing, typeScale, useTheme } from '@/theme';

/**
 * 2탭 확인 버튼 — 1탭에 질문 + [취소][확인]으로 전환되고(주요 버튼은 오른쪽), 확인 시 onConfirm을 실행한다.
 * pending이 true→false로 떨어지면(성공·실패 무관) 자동으로 원래 버튼으로 복귀한다.
 * 실패 안내 캡션은 호출부가 뮤테이션 상태로 표시한다.
 */
export function ConfirmButton({ label, question, confirmLabel = '확인', tone = 'ink', variant = 'outline', pending = false, onConfirm }: {
  label: string;
  question: string;
  confirmLabel?: string;
  /** 확인 버튼 색 — ink(완독 등) | danger(하차 등). 제자리 확인은 화면의 CTA 가 아니라 악센트를 쓰지 않는다. */
  tone?: 'ink' | 'danger';
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
    // 위험 확인은 연한 빨강, 그 밖(완독 등)은 잉크 — 공용 Button 과 같은 면(controlFace)에 색만 바꾼다.
    const confirmFace = controlFace(tone === 'danger' ? colors.dangerSoft : colors.ink);
    const confirmFg = tone === 'danger' ? colors.danger : colors.onInk;
    return (
      <View style={styles.row}>
        <Text style={[typeScale.caption, { color: colors.textMuted, flex: 1 }]}>{question}</Text>
        <Pressable
          disabled={pending}
          onPress={() => setArming(false)}
          accessibilityRole="button"
          accessibilityLabel="취소"
          style={({ pressed }) => [styles.button, controlFace(colors.tonal), pending && styles.pending, pressed && !pending && pressedStyle]}
        >
          <Text style={[styles.label, { color: colors.text }]}>취소</Text>
        </Pressable>
        <Pressable
          disabled={pending}
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          style={({ pressed }) => [styles.button, confirmFace, pending && styles.pending, pressed && !pending && pressedStyle]}
        >
          <Text style={[styles.label, { color: confirmFg }]}>
            {pending ? '처리 중…' : confirmLabel}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setArming(true)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        styles.idle,
        variant === 'outline' ? controlFace(colors.tonal) : null,
        pressed && pressedStyle,
      ]}
    >
      <Text style={[styles.label, { color: variant === 'ghost' ? colors.textMuted : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: {
    minHeight: controlHeight.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typeScale.label, fontSize: 14 },
  idle: { alignSelf: 'stretch' },
  // 처리 중 — 공용 Button 의 비활성(0.35)과 같은 값.
  pending: { opacity: 0.35 },
});
