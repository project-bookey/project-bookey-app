import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { API_BASE_URL } from '@/api/client';
import { Button, Field, OrnamentDivider, Rule, Screen } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { colors, fonts, spacing, type } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

/**
 * 로그인.
 * Google은 로그인과 최초 가입을 같은 흐름으로 처리한다.
 * 개발용 로그인은 DEV_LOGIN_ENABLED=true인 백엔드에서만 성공한다.
 */
export default function LoginScreen() {
  const router = useRouter();
  const devLogin = useAuth((s) => s.devLogin);
  const googleLogin = useAuth((s) => s.googleLogin);
  const [handle, setHandle] = useState('tester');
  const [nickname, setNickname] = useState('테스터');
  const [devLoading, setDevLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleClientIds = useMemo(() => ({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  }), []);

  const hasGoogleClient = Boolean(
    googleClientIds.webClientId || googleClientIds.iosClientId || googleClientIds.androidClientId,
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
      .then(() => router.replace('/(tabs)/home'))
      .catch((e) => setError(e instanceof Error ? e.message : 'Google 로그인에 실패했습니다.'))
      .finally(() => setGoogleLoading(false));
  }, [googleLogin, response, router]);

  const submitDevLogin = async () => {
    setDevLoading(true);
    setError(null);
    try {
      await devLogin(handle.trim(), nickname.trim());
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인에 실패했습니다.');
    } finally {
      setDevLoading(false);
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

          <OrnamentDivider />

          <View style={styles.devPanel}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setError(null)}
              style={styles.devHeader}
            >
              <Text style={styles.devTitle}>개발용 로그인</Text>
              <Text style={styles.devBadge}>DEV</Text>
            </Pressable>
            <Field
              label="개발용 계정 ID"
              value={handle}
              onChangeText={setHandle}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="tester"
              hint="같은 ID로 다시 로그인하면 같은 계정으로 들어갑니다."
            />
            <Field
              label="닉네임"
              value={nickname}
              onChangeText={setNickname}
              placeholder="테스터"
            />
            <Button
              label="개발 계정으로 시작"
              onPress={submitDevLogin}
              loading={devLoading}
              variant="outline"
            />
          </View>

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
  devPanel: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  devTitle: { ...type.subtitle, color: colors.ink },
  devBadge: {
    ...type.caption,
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fieldError: { ...type.caption, color: colors.danger, lineHeight: 17 },
  footer: { gap: spacing.md },
  meta: { ...type.caption, color: colors.textFaint, fontVariant: ['tabular-nums'] },
});
