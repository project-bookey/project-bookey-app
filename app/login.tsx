import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { API_BASE_URL } from '@/api/client';
import { hasKakaoClient, useKakaoLogin } from '@/hooks/useKakaoLogin';
import { useAuth } from '@/store/auth';
import { darkColors, hairline, radius, sans, spacing, typeScale } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

/** 애플 모듈은 iOS에서만 실행 로드 (번들엔 포함되나 다른 플랫폼에선 실행되지 않음, Expo Go 미포함 대비 try/catch). */
let Apple: typeof import('expo-apple-authentication') | null = null;
if (Platform.OS === 'ios') {
  try {
    Apple = require('expo-apple-authentication');
  } catch {
    Apple = null;
  }
}

type SocialProvider = 'APPLE' | 'KAKAO' | 'GOOGLE';

/**
 * 로그인 — 다크 고정, 심플 플랫 레이아웃 (사용자 결정: 그라데이션 대신 이전 구성 유지).
 * 이메일 폼이 주인공, 소셜(애플·카카오·구글)은 보조. 소셜은 로그인=최초 가입.
 */
export default function LoginScreen() {
  const router = useRouter();
  const emailLogin = useAuth((s) => s.emailLogin);
  const emailSignup = useAuth((s) => s.emailSignup);
  const socialLogin = useAuth((s) => s.socialLogin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const kakao = useKakaoLogin();

  useEffect(() => {
    Apple?.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const googleClientIds = useMemo(() => ({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'not-configured',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'not-configured',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || 'not-configured',
  }), []);

  const hasGoogleClient = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  );

  const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    ...googleClientIds,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    const idToken = googleResponse?.type === 'success' ? googleResponse.params.id_token : undefined;
    if (!idToken) {
      if (googleResponse?.type === 'error') {
        setError('Google 로그인을 완료하지 못했습니다.');
      }
      if (googleResponse) {
        setSocialLoading(null);
      }
      return;
    }
    setSocialLoading('GOOGLE');
    setError(null);
    socialLogin('GOOGLE', idToken)
      .then(() => router.replace('/home'))
      .catch((e) => setError(e instanceof Error ? e.message : 'Google 로그인에 실패했습니다.'))
      .finally(() => setSocialLoading(null));
  }, [googleResponse, router, socialLogin]);

  const submitEmail = async () => {
    setEmailLoading(true);
    setError(null);
    try {
      if (isSignup) {
        await emailSignup(email.trim(), password, nickname.trim());
      } else {
        await emailLogin(email.trim(), password);
      }
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : '인증에 실패했습니다.');
    } finally {
      setEmailLoading(false);
    }
  };

  const submitApple = async () => {
    if (!Apple || busy) return; // 네이티브 버튼엔 disabled가 없어 진행 중 중복 실행을 여기서 막는다

    setSocialLoading('APPLE');
    setError(null);
    try {
      const credential = await Apple.signInAsync({
        requestedScopes: [
          Apple.AppleAuthenticationScope.FULL_NAME,
          Apple.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple 인증 토큰을 받지 못했습니다.');
      }
      // 이름은 최초 로그인 1회만 온다 — 서버는 id_token에서 이름을 얻지 못하므로 여기서 전달.
      const fullName = [credential.fullName?.familyName, credential.fullName?.givenName]
        .filter(Boolean).join('');
      await socialLogin('APPLE', credential.identityToken, fullName || undefined);
      router.replace('/home');
    } catch (e) {
      if ((e as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') {
        setError(e instanceof Error ? e.message : 'Apple 로그인에 실패했습니다.');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const submitKakao = async () => {
    setSocialLoading('KAKAO');
    setError(null);
    try {
      const accessToken = await kakao.login();
      if (!accessToken) return; // 사용자가 취소
      await socialLogin('KAKAO', accessToken);
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : '카카오 로그인에 실패했습니다.');
    } finally {
      setSocialLoading(null);
    }
  };

  const submitGoogle = async () => {
    setSocialLoading('GOOGLE');
    setError(null);
    try {
      await promptGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google 로그인 창을 열지 못했습니다.');
      setSocialLoading(null);
    }
  };

  const showApple = Boolean(Apple) && appleAvailable;
  const hasSocial = showApple || hasKakaoClient || hasGoogleClient;
  const busy = emailLoading || socialLoading != null;

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View>
            <Text style={styles.wordmark}>bookey</Text>
            <View style={styles.wordmarkRule} />
            <Text style={styles.tagline}>
              읽기로 한 책을 끝까지.{'\n'}읽은 사람만 리뷰를 쓴다.
            </Text>
          </View>

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
                placeholder="you@example.com"
                placeholderTextColor={darkColors.textFaint}
                accessibilityLabel="이메일"
                textContentType="emailAddress"
                autoComplete="email"
                inputMode="email"
              />
            </View>
            {isSignup ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>닉네임</Text>
                <TextInput
                  style={styles.input}
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="독서가"
                  placeholderTextColor={darkColors.textFaint}
                  accessibilityLabel="닉네임"
                  textContentType="nickname"
                />
              </View>
            ) : null}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>비밀번호</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="8자 이상"
                placeholderTextColor={darkColors.textFaint}
                accessibilityLabel="비밀번호"
                textContentType={isSignup ? 'newPassword' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </View>
            <Pressable
              onPress={submitEmail}
              disabled={busy}
              style={({ pressed }) => [styles.cta, (pressed || busy) && styles.pressed]}
              accessibilityRole="button"
            >
              {emailLoading
                ? <ActivityIndicator color={darkColors.onAccent} />
                : <Text style={styles.ctaLabel}>{isSignup ? '이메일로 회원가입' : '이메일로 로그인'}</Text>}
            </Pressable>
            <Pressable
              onPress={() => { setIsSignup(!isSignup); setError(null); }}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
            >
              <Text style={styles.ghostLabel}>
                {isSignup ? '로그인으로 돌아가기' : '처음 가입하기'}
              </Text>
            </Pressable>
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          </View>

          {hasSocial ? (
            <View style={styles.divider}>
              <View style={styles.dividerRule} />
              <Text style={styles.dividerLabel}>또는</Text>
              <View style={styles.dividerRule} />
            </View>
          ) : null}

          <View style={styles.social}>
            {showApple && Apple ? (
              <Apple.AppleAuthenticationButton
                buttonType={Apple.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={Apple.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={radius.md}
                style={styles.appleButton}
                onPress={submitApple}
              />
            ) : null}
            {hasKakaoClient ? (
              <Pressable
                onPress={submitKakao}
                disabled={busy || !kakao.ready}
                style={({ pressed }) => [styles.kakaoButton, (pressed || busy) && styles.pressed]}
                accessibilityRole="button"
              >
                {socialLoading === 'KAKAO'
                  ? <ActivityIndicator color="#191919" />
                  : <Text style={styles.kakaoLabel}>카카오로 계속하기</Text>}
              </Pressable>
            ) : null}
            {hasGoogleClient ? (
              <Pressable
                onPress={submitGoogle}
                disabled={busy || !googleRequest}
                style={({ pressed }) => [styles.googleButton, (pressed || busy) && styles.pressed]}
                accessibilityRole="button"
              >
                {socialLoading === 'GOOGLE'
                  ? <ActivityIndicator color={darkColors.text} />
                  : <Text style={styles.googleLabel}>Google로 계속하기</Text>}
              </Pressable>
            ) : null}
          </View>

          {__DEV__ ? (
            <View style={styles.devInfo}>
              <View style={styles.devRule} />
              {!hasKakaoClient ? (
                <Text style={styles.devLine}>카카오 미설정 — EXPO_PUBLIC_KAKAO_REST_KEY</Text>
              ) : null}
              {!hasGoogleClient ? (
                <Text style={styles.devLine}>구글 미설정 — EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID</Text>
              ) : null}
              <Text style={styles.devLine}>API {API_BASE_URL}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const BUTTON_HEIGHT = 48;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: darkColors.bg },
  fill: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  wordmark: {
    fontFamily: sans.extraBold,
    fontSize: 40,
    color: darkColors.text,
    letterSpacing: 0.5,
  },
  wordmarkRule: { width: 40, height: 3, backgroundColor: darkColors.text, marginTop: spacing.md },
  tagline: { ...typeScale.body, color: darkColors.textMuted, marginTop: spacing.lg, lineHeight: 23 },
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
  cta: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: darkColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  ctaLabel: { ...typeScale.bodyStrong, color: darkColors.onAccent },
  ghost: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { ...typeScale.label, color: darkColors.textMuted },
  error: { ...typeScale.caption, color: darkColors.danger },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividerRule: { flex: 1, height: hairline, backgroundColor: darkColors.lineStrong },
  dividerLabel: { ...typeScale.caption, color: darkColors.textFaint },
  social: { gap: spacing.sm },
  appleButton: { height: BUTTON_HEIGHT, width: '100%' },
  kakaoButton: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: '#FEE500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoLabel: { ...typeScale.bodyStrong, color: '#191919' },
  googleButton: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: darkColors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLabel: { ...typeScale.bodyStrong, color: darkColors.text },
  pressed: { opacity: 0.75 },
  devInfo: { gap: spacing.sm },
  devRule: { height: hairline, backgroundColor: darkColors.line },
  devLine: { ...typeScale.caption, color: darkColors.textFaint, fontVariant: ['tabular-nums'] },
});
