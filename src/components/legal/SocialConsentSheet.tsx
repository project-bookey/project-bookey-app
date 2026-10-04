import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SignupConsent } from '@/api/types';
import { hairline, pressedStyle, radius, spacing, typeScale, type ColorTokens } from '@/theme';

import { consentComplete, EMPTY_CONSENT, SignupConsentBox, toSignupConsent, type ConsentDraft } from './SignupConsentBox';

/**
 * 처음 보는 소셜 계정의 가입 동의 — 서버가 LEGAL_CONSENT_REQUIRED 로 돌려보내면 띄운다.
 * 동의하면 같은 소셜 토큰으로 다시 로그인을 부른다(계정은 그때 만들어진다). 버튼 순서는 [취소][동의하고 가입].
 */
export function SocialConsentSheet({ visible, colors, busy, error, onCancel, onSubmit }: {
  visible: boolean;
  colors: ColorTokens;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (consent: SignupConsent) => void;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ConsentDraft>(EMPTY_CONSENT);
  const complete = consentComplete(draft);

  // 다시 열 때마다 빈 동의에서 시작한다 — 다른 소셜 계정으로 다시 시도할 수 있다.
  useEffect(() => {
    if (visible) setDraft(EMPTY_CONSENT);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Bookey에 처음 오셨네요</Text>
          <Text style={styles.copy}>가입을 마치려면 아래 내용에 동의해 주세요.</Text>
          <SignupConsentBox colors={colors} value={draft} onChange={setDraft} disabled={busy} />
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        </ScrollView>
        <View style={styles.footer}>
          <Pressable
            onPress={onCancel}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cancel, pressed && pressedStyle]}
          >
            <Text style={styles.cancelLabel}>취소</Text>
          </Pressable>
          <Pressable
            onPress={() => onSubmit(toSignupConsent(draft))}
            disabled={!complete || busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: !complete || busy }}
            style={({ pressed }) => [styles.submit, (!complete || busy) && styles.submitDisabled, pressed && pressedStyle]}
          >
            {busy
              ? <ActivityIndicator color={colors.onAccent} />
              : <Text style={styles.submitLabel}>동의하고 가입</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({
    sheet: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, gap: spacing.md },
    title: { ...typeScale.title, color: colors.text },
    copy: { ...typeScale.body, color: colors.textMuted, marginBottom: spacing.sm },
    error: { ...typeScale.caption, color: colors.danger },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.lg,
      borderTopWidth: hairline,
      borderTopColor: colors.lineStrong,
    },
    cancel: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.sm,
      borderWidth: hairline,
      borderColor: colors.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelLabel: { ...typeScale.bodyStrong, color: colors.text },
    submit: {
      flex: 2,
      minHeight: 48,
      borderRadius: radius.sm,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitDisabled: { opacity: 0.45 },
    submitLabel: { ...typeScale.bodyStrong, color: colors.onAccent },
  });
}
