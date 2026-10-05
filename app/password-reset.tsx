import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { CODE_EXPIRED_MESSAGE, FieldError, isEmail, withResendsLeft, TimedCodeInput } from '@/components/auth/authFields';
import { KeyboardArea, useScrollReveal } from '@/components/keyboard';
import { useSecondsLeft } from '@/hooks/useSecondsLeft';
import { useAuth } from '@/store/auth';
import { darkColors, hairline, pressedStyle, radius, sans, spacing, typeScale } from '@/theme';

const BUTTON_HEIGHT = 48;
const MIN_PASSWORD = 8;

/** 경고를 띄우는 자리 — 칸에 걸린 오류는 그 칸 밑에, 어느 칸에도 걸리지 않는 오류는 버튼 바로 위(form)에. 가입 화면과 같다. */
type ErrorSpot = 'email' | 'code' | 'password' | 'form';
type FormErrors = Partial<Record<ErrorSpot, string>>;

/** 서버 오류 코드가 가리키는 칸. 여기 없는 코드는 부른 쪽이 정한 자리에 둔다. */
const SERVER_ERROR_SPOT: Record<string, ErrorSpot> = {
  EMAIL_NOT_REGISTERED: 'email',
  USER_SUSPENDED: 'email',
  EMAIL_CODE_INVALID: 'code',
  EMAIL_CODE_EXPIRED: 'code',
};

/**
 * 비밀번호 찾기 — 로그인과 같은 다크 고정. 두 단계다:
 * ① 가입한 이메일로 6자리 코드를 받고 ② 코드와 새 비밀번호를 넣는다.
 * 성공하면 서버가 다른 기기를 로그아웃시키고 로그인 토큰을 주므로 로그인 화면을 거치지 않고 서가로 간다.
 * 로그인 화면에서 입력해 둔 이메일은 email 파라미터로 받아 다시 치지 않게 한다.
 * 입력 오류는 가입 화면처럼 그 칸 밑에 띄우고, 코드 칸 안에는 남은 입력 시간(서버 expiresInSec)을 센다.
 * 다시 받기는 기다림 없이 바로 된다 — 남용은 서버가 1시간 횟수 상한으로 막는다.
 */
export default function PasswordResetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const resetPassword = useAuth((s) => s.resetPassword);
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(emailParam ?? '');
  /** 코드를 보낸 주소 — 값이 있으면 ② 단계(코드·새 비밀번호)다. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [validMinutes, setValidMinutes] = useState(3);
  /** 보낸 코드를 입력할 수 있는 마지막 시각(ms). */
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const codeLeft = useSecondsLeft(codeExpiresAt);
  const [resent, setResent] = useState(false);
  /** 이 이메일로 1시간 안에 더 받을 수 있는 코드 수 — 서버가 알려 주지 않으면 null(안내에서 뺀다). */
  const [resendsLeft, setResendsLeft] = useState<number | null>(null);
  const [code, setCode] = useState('');
  // 코드는 숫자 키패드라 iOS 에선 닫는 키가 없다 — 칸을 누르면 '비밀번호 바꾸기'까지 키보드 위로 올린다.
  const scrollRef = useRef<ScrollView>(null);
  const submitRef = useRef<View>(null);
  const revealAbove = useScrollReveal(scrollRef);
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const busy = sending || saving;
  const codeTiming = sentTo != null && codeExpiresAt != null;
  const codeExpired = codeTiming && codeLeft === 0;
  const codeError = errors.code ?? (codeExpired ? CODE_EXPIRED_MESSAGE : undefined);

  /** 한 자리의 경고만 바꾼다(null 이면 지운다) — 다른 칸에 떠 있는 경고는 그대로 둔다. */
  const putError = (spot: ErrorSpot, message: string | null) => setErrors((prev) => {
    if ((prev[spot] ?? null) === message) return prev;
    const next = { ...prev };
    if (message) next[spot] = message;
    else delete next[spot];
    return next;
  });
  /** 서버 오류가 가리키는 칸 — 코드 단계에는 이메일 칸이 없으니 그때는 버튼 위로. */
  const errorSpotOf = (e: unknown, fallback: ErrorSpot): ErrorSpot => {
    const spot = e instanceof ApiError ? SERVER_ERROR_SPOT[e.code] : undefined;
    return spot && !(spot === 'email' && sentTo) ? spot : fallback;
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  const sendCode = async () => {
    const target = (sentTo ?? email).trim();
    // 코드 단계의 '다시 받기'가 실패하면 그 버튼이 있는 코드 칸 밑에, 이메일 단계면 버튼 위에 둔다.
    const fallback: ErrorSpot = sentTo ? 'code' : 'form';
    if (!target || !isEmail(target)) {
      putError('email', target ? '이메일 주소를 다시 확인해 주세요.' : '가입한 이메일을 입력해 주세요.');
      return;
    }
    setSending(true);
    putError('form', null);
    putError(sentTo ? 'code' : 'email', null);
    // 입력 마감은 요청을 보낸 때부터 센다 — 서버보다 늦게 끝나 '0:01'에 낸 코드가 거절되지 않게.
    const requestedAt = Date.now();
    try {
      const result = await authApi.requestPasswordResetCode(target);
      setResent(sentTo != null);
      setSentTo(target);
      setValidMinutes(Math.max(1, Math.round(result.expiresInSec / 60)));
      setResendsLeft(result.resendsLeft ?? null);
      setCodeExpiresAt(requestedAt + result.expiresInSec * 1000);
      // 새 코드를 받으면 이전 코드는 못 쓴다. 로컬 서버는 devCode 를 동봉한다 — 개발 편의로 자동 입력.
      setCode(result.devCode ?? '');
    } catch (e) {
      putError(errorSpotOf(e, fallback), e instanceof Error ? e.message : '코드를 보내지 못했어요.');
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
    setCodeExpiresAt(null);
    setErrors({});
  };

  const submit = async () => {
    if (!sentTo) return;
    // 잘못된 칸을 한 번에 모두 짚는다 — 하나 고치고 다시 눌러야 다음 칸 경고가 보이지 않게.
    const found: FormErrors = {};
    if (code.trim().length !== 6) {
      found.code = '이메일로 받은 6자리 코드를 입력해 주세요.';
    } else if (codeExpired) {
      found.code = CODE_EXPIRED_MESSAGE;
    }
    if (password.length < MIN_PASSWORD) {
      found.password = `새 비밀번호는 ${MIN_PASSWORD}자 이상으로 정해 주세요.`;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await resetPassword(sentTo, code.trim(), password);
      // 아래에 깔린 로그인 화면까지 걷어 내고 서가로 — 뒤로 가기로 로그인 화면이 다시 나오지 않게 한다.
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace('/home');
    } catch (e) {
      putError(errorSpotOf(e, 'form'), e instanceof Error ? e.message : '비밀번호를 바꾸지 못했어요.');
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
          ref={scrollRef}
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
                  {/* 입력 마감까지 남은 시간은 칸 안 오른쪽 — 가입 화면과 같은 자리. */}
                  <TimedCodeInput
                    colors={darkColors}
                    inputStyle={styles.input}
                    timing={codeTiming}
                    secondsLeft={codeLeft}
                    error={codeError}
                    value={code}
                    onChangeText={(value) => {
                      setCode(value);
                      putError('code', null);
                    }}
                    accessibilityLabel="인증 코드"
                    onFocus={() => revealAbove(submitRef)}
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
                <FieldError colors={darkColors} message={codeError} />
                <Text style={styles.hint}>
                  {withResendsLeft(`${resent ? '새 코드를 보냈어요. ' : ''}${validMinutes}분 안에 입력해 주세요.`, resendsLeft)}
                </Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>새 비밀번호</Text>
                <TextInput
                  style={[styles.input, errors.password ? styles.inputError : null]}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    putError('password', null);
                  }}
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
                  onFocus={() => revealAbove(submitRef)}
                />
                <FieldError colors={darkColors} message={errors.password} />
              </View>
              {/* 어느 칸에도 걸리지 않는 실패는 누른 버튼 바로 위에 — 가입 화면과 같은 자리(Proximity). */}
              <FieldError colors={darkColors} message={errors.form} />
              <Pressable
                ref={submitRef}
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
                  style={[styles.input, errors.email ? styles.inputError : null]}
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    putError('email', null);
                  }}
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
                <FieldError colors={darkColors} message={errors.email} />
              </View>
              <FieldError colors={darkColors} message={errors.form} />
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
  inputError: { borderColor: darkColors.danger },
  codeRow: { flexDirection: 'row', gap: spacing.sm },
  codeButton: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.md,
    borderWidth: hairline,
    borderColor: darkColors.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  codeButtonLabel: { ...typeScale.label, color: darkColors.text },
  hint: { ...typeScale.caption, color: darkColors.textFaint },
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
  // 로그인 화면의 '회원가입'과 같은 보조 버튼 — 주요 버튼 아래 테두리 버튼.
  ghost: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: darkColors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { ...typeScale.label, color: darkColors.text },
  pressed: pressedStyle,
});
