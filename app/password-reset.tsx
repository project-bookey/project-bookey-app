import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authApi } from '@/api/endpoints';
import { KeyboardArea } from '@/components/keyboard';
import { useAuth } from '@/store/auth';
import { darkColors, hairline, pressedStyle, radius, sans, spacing, typeScale } from '@/theme';

const BUTTON_HEIGHT = 48;
const MIN_PASSWORD = 8;

/**
 * 비밀번호 찾기 — 로그인과 같은 다크 고정. 두 단계다:
 * ① 가입한 이메일로 6자리 코드를 받고 ② 코드와 새 비밀번호를 넣는다.
 * 성공하면 서버가 다른 기기를 로그아웃시키고 로그인 토큰을 주므로 로그인 화면을 거치지 않고 서가로 간다.
 * 로그인 화면에서 입력해 둔 이메일은 email 파라미터로 받아 다시 치지 않게 한다.
 */
export default function PasswordResetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const resetPassword = useAuth((s) => s.resetPassword);
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(emailParam ?? '');
  /** 코드를 보낸 주소 — 값이 있으면 ② 단계(코드·새 비밀번호)다. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [validMinutes, setValidMinutes] = useState(10);
  const [resent, setResent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = sending || saving;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  const sendCode = async () => {
    const target = (sentTo ?? email).trim();
    if (!target) {
      setError('가입한 이메일을 입력해 주세요.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await authApi.requestPasswordResetCode(target);
      setResent(sentTo != null);
      setSentTo(target);
      setValidMinutes(Math.max(1, Math.round(result.expiresInSec / 60)));
      // 새 코드를 받으면 이전 코드는 못 쓴다. 로컬 서버는 devCode 를 동봉한다 — 개발 편의로 자동 입력.
      setCode(result.devCode ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : '코드를 보내지 못했습니다.');
    } finally {
      setSending(false);
    }
  };

  /** ② → ① — 이메일을 잘못 넣었을 때. 받은 코드와 새 비밀번호는 비운다. */
  const changeEmail = () => {
    setSentTo(null);
    setResent(false);
    setCode('');
    setPassword('');
    setError(null);
  };

  const submit = async () => {
    if (!sentTo) return;
    if (code.trim().length !== 6) {
      setError('이메일로 받은 6자리 코드를 입력해 주세요.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`새 비밀번호는 ${MIN_PASSWORD}자 이상으로 정해 주세요.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await resetPassword(sentTo, code.trim(), password);
      // 아래에 깔린 로그인 화면까지 걷어 내고 서가로 — 뒤로 가기로 로그인 화면이 다시 나오지 않게 한다.
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : '비밀번호를 바꾸지 못했습니다.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardArea>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Text style={styles.backGlyph}>←</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <Text style={styles.title}>비밀번호 찾기</Text>
            {sentTo ? (
              <Text style={styles.lead}>
                <Text style={styles.leadStrong}>{sentTo}</Text>
                {' 로 코드를 보냈어요. 코드와 새 비밀번호를 입력해 주세요.'}
              </Text>
            ) : (
              <Text style={styles.lead}>가입한 이메일로 6자리 코드를 보내 드려요.</Text>
            )}
          </View>

          {sentTo ? (
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>인증 코드</Text>
                <View style={styles.codeRow}>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="6자리"
                    placeholderTextColor={darkColors.textFaint}
                    accessibilityLabel="인증 코드"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                  />
                  <Pressable
                    onPress={sendCode}
                    disabled={busy}
                    style={({ pressed }) => [styles.codeButton, (pressed || busy) && styles.pressed]}
                    accessibilityRole="button"
                  >
                    {sending
                      ? <ActivityIndicator color={darkColors.text} />
                      : <Text style={styles.codeButtonLabel}>다시 받기</Text>}
                  </Pressable>
                </View>
                <Text style={styles.hint}>
                  {resent ? '새 코드를 보냈어요. ' : ''}
                  {`${validMinutes}분 안에 입력해 주세요.`}
                </Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>새 비밀번호</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  maxLength={72}
                  placeholder={`${MIN_PASSWORD}자 이상`}
                  placeholderTextColor={darkColors.textFaint}
                  accessibilityLabel="새 비밀번호"
                  textContentType="newPassword"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />
              </View>
              {/* 실패 안내는 누른 버튼 바로 위에 — 로그인 화면과 같은 자리(Proximity). */}
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              <Pressable
                onPress={submit}
                disabled={busy}
                style={({ pressed }) => [styles.cta, (pressed || busy) && styles.ctaDisabled]}
                accessibilityRole="button"
              >
                {saving
                  ? <ActivityIndicator color={darkColors.onAccent} />
                  : <Text style={styles.ctaLabel}>비밀번호 바꾸기</Text>}
              </Pressable>
              <Pressable
                onPress={changeEmail}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
              >
                <Text style={styles.ghostLabel}>이메일 다시 입력하기</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>이메일</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={!emailParam}
                  placeholder="you@example.com"
                  placeholderTextColor={darkColors.textFaint}
                  accessibilityLabel="이메일"
                  textContentType="emailAddress"
                  autoComplete="email"
                  inputMode="email"
                  returnKeyType="send"
                  onSubmitEditing={sendCode}
                />
              </View>
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              <Pressable
                onPress={sendCode}
                disabled={busy}
                style={({ pressed }) => [styles.cta, (pressed || busy) && styles.ctaDisabled]}
                accessibilityRole="button"
              >
                {sending
                  ? <ActivityIndicator color={darkColors.onAccent} />
                  : <Text style={styles.ctaLabel}>코드 받기</Text>}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardArea>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: darkColors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backGlyph: { fontSize: 22, color: darkColors.text },
  container: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.xl,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  intro: { gap: spacing.sm },
  title: { ...typeScale.title, color: darkColors.text },
  lead: { ...typeScale.body, color: darkColors.textMuted },
  leadStrong: { fontFamily: sans.semiBold, color: darkColors.text },
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  fieldLabel: { ...typeScale.label, color: darkColors.textMuted },
  input: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.md,
    borderWidth: hairline,
    borderColor: darkColors.lineStrong,
    backgroundColor: darkColors.surface,
    color: darkColors.text,
    paddingHorizontal: spacing.md,
    fontFamily: sans.regular,
    fontSize: 15,
  },
  codeRow: { flexDirection: 'row', gap: spacing.sm },
  codeInput: { flex: 1 },
  codeButton: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.md,
    borderWidth: hairline,
    borderColor: darkColors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  codeButtonLabel: { ...typeScale.label, color: darkColors.text },
  hint: { ...typeScale.caption, color: darkColors.textFaint },
  error: { ...typeScale.caption, color: darkColors.danger },
  cta: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.sm,
    backgroundColor: darkColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  ctaLabel: { ...typeScale.bodyStrong, color: darkColors.onAccent },
  ctaDisabled: { opacity: 0.45 },
  ghost: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { ...typeScale.label, color: darkColors.textMuted },
  pressed: pressedStyle,
});
