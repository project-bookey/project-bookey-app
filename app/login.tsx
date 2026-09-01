import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { API_BASE_URL } from '@/api/client';
import { Button, Field, Rule, Screen } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { colors, fonts, spacing, type } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

/**
 * 로그인.
 * Google은 로그인과 최초 가입을 같은 흐름으로 처리한다.
 */
export default function LoginScreen() {
  const router = useRouter();
  const googleLogin = useAuth((s) => s.googleLogin);
  const emailLogin = useAuth((s) => s.emailLogin);
  const emailSignup = useAuth((s) => s.emailSignup);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    ...googleClientIds,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    const idToken = response?.type === 'success' ? response.params.id_token : undefined;
    if (!idToken) {
      if (response?.type === 'error') {
        setError('Google 로그인을 완료하지 못했습니다.');
      }
      if (response) {
        setGoogleLoading(false);
      }
      return;
    }

    setGoogleLoading(true);
    setError(null);
    googleLogin(idToken)
      .then(() => router.replace('/home'))
      .catch((e) => setError(e instanceof Error ? e.message : 'Google 로그인에 실패했습니다.'))
      .finally(() => setGoogleLoading(false));
  }, [googleLogin, response, router]);

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

  const submitGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await promptAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google 로그인 창을 열지 못했습니다.');
      setGoogleLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View>
            <Text style={styles.logo}>bookey</Text>
            <View style={styles.logoRule} />
            <Text style={styles.tagline}>
              읽기로 한 책을 끝까지.{'\n'}읽은 사람만 리뷰를 쓴다.
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>계정 시작</Text>
            <Text style={styles.panelCopy}>
              Google 계정으로 로그인합니다. 처음 방문한 계정은 바로 가입됩니다.
            </Text>
            <Button
              label="Google로 계속하기"
              onPress={submitGoogleLogin}
              disabled={!hasGoogleClient || !request}
              loading={googleLoading}
            />
            {!hasGoogleClient ? (
              <Text style={styles.fieldError}>
                EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID 또는 플랫폼별 Google Client ID가 필요합니다.
              </Text>
            ) : null}
            {error ? <Text style={styles.fieldError}>{error}</Text> : null}
          </View>

          <Field
            label="이메일"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@example.com"
          />
          {isSignup ? (
            <Field label="닉네임" value={nickname} onChangeText={setNickname} placeholder="독서가" />
          ) : null}
          <Field
            label="비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="8자 이상"
          />
          <Button
            label={isSignup ? "이메일로 회원가입" : "이메일로 로그인"}
            onPress={submitEmail}
            loading={emailLoading}
          />
          <Button
            label={isSignup ? "로그인으로 돌아가기" : "처음 가입하기"}
            onPress={() => { setIsSignup(!isSignup); setError(null); }}
            variant="ghost"
          />

          <View style={styles.footer}>
            <Rule />
            <Text style={styles.meta}>API {API_BASE_URL}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xxl,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  logo: {
    fontFamily: fonts.serif,
    fontSize: 40,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  logoRule: { width: 40, height: 3, backgroundColor: colors.ink, marginTop: spacing.md },
  tagline: { ...type.body, color: colors.textMuted, marginTop: spacing.lg, lineHeight: 23 },
  panel: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  panelTitle: { ...type.title, color: colors.ink },
  panelCopy: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  fieldError: { ...type.caption, color: colors.danger, lineHeight: 17 },
  footer: { gap: spacing.md },
  meta: { ...type.caption, color: colors.textFaint, fontVariant: ['tabular-nums'] },
});
