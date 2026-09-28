import * as Google from 'expo-auth-session/providers/google';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { useQuery } from '@tanstack/react-query';

import { API_BASE_URL } from '@/api/client';
import { authApi, libraryApi } from '@/api/endpoints';
import { useOnboarding } from '@/store/onboarding';
import { hasKakaoClient, useKakaoLogin } from '@/hooks/useKakaoLogin';
import { useAuth } from '@/store/auth';
import { darkColors, hairline, pressedStyle, radius, sans, spacing, typeScale } from '@/theme';
import { LEGAL_DOCUMENTS, LEGAL_VERSION, LegalDocumentKey } from '@/legal/documents';

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

const BUTTON_HEIGHT = 48;

/**
 * 로그인 — 다크 고정, 심플 플랫 레이아웃 (사용자 결정: 그라데이션 대신 이전 구성 유지).
 * 이메일 폼이 주인공, 소셜(애플·카카오·구글)은 보조. 소셜 버튼은 연동된 계정의 로그인 전용(신규 가입 불가).
 * 가입 인증은 서버 설정(signup-config)을 따른다 — IDENTITY, EMAIL_CODE 또는 NONE.
 * 가입 성공 시 온보딩에서 고른 카테고리·책을 반영하고 바로 홈으로 넘어간다.
 */
export default function LoginScreen() {
  const router = useRouter();
  const emailLogin = useAuth((s) => s.emailLogin);
  const emailSignup = useAuth((s) => s.emailSignup);
  const socialLogin = useAuth((s) => s.socialLogin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  /** 온보딩의 "가입하고 시작하기"는 signup=1 로 들어와 곧장 가입 폼을 연다. */
  const { signup: signupParam } = useLocalSearchParams<{ signup?: string }>();
  const [isSignup, setIsSignup] = useState(signupParam === '1');
  /** 휴대폰 본인인증 완료 id — IDENTITY 모드에서 가입 요청에 실어 보낸다. */
  const [identityId, setIdentityId] = useState<string | null>(null);
  const signupConfig = useQuery({
    queryKey: ['signupConfig'],
    queryFn: authApi.signupConfig,
    staleTime: 60_000,
  });
  const onboardingPicks = useOnboarding();
  const [emailLoading, setEmailLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [legalOpen, setLegalOpen] = useState<LegalDocumentKey | null>(null);
  const [legalReadToEnd, setLegalReadToEnd] = useState(false);
  const [legalAgreed, setLegalAgreed] = useState<Record<LegalDocumentKey, boolean>>({
    terms: false,
    privacy: false,
  });

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
      .then(async (newUser) => {
        if (newUser) {
          await applyOnboardingPicks();
        }
        router.replace('/home');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Google 로그인에 실패했습니다.'))
      .finally(() => setSocialLoading(null));
  }, [googleResponse, router, socialLogin]);

  const requestCode = async () => {
    if (!email.trim()) {
      setError('이메일을 먼저 입력해 주세요.');
      return;
    }
    setCodeLoading(true);
    setError(null);
    try {
      const result = await authApi.requestEmailCode(email.trim());
      setCodeSent(true);
      // 로컬 서버는 devCode 를 동봉한다 — 개발 편의로 자동 입력.
      if (result.devCode) {
        setCode(result.devCode);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '인증 코드를 요청하지 못했습니다.');
    } finally {
      setCodeLoading(false);
    }
  };

  /** 온보딩(카테고리·책 5권) 선택을 가입 직후 서버에 반영한다 — 일부 실패해도 가입 흐름은 계속. */
  const applyOnboardingPicks = async () => {
    const jobs: Promise<unknown>[] = [];
    if (onboardingPicks.categories.length > 0) {
      jobs.push(authApi.updateProfile({ preferredCategories: onboardingPicks.categories }));
    }
    onboardingPicks.bookIds.forEach((bookId) => {
      jobs.push(libraryApi.add({ bookId, status: 'WANT_TO_READ' }));
    });
    if (jobs.length > 0) {
      await Promise.allSettled(jobs);
    }
    onboardingPicks.clear();
  };

  /** 본인인증 시작 — 개발 스텁이면 즉시 통과, 실서비스는 포트원 SDK 연동 지점. */
  const startIdentityVerification = () => {
    const config = signupConfig.data;
    if (!config) return;
    setError(null);
    if (config.identityDevStub) {
      setIdentityId(`dev-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`);
      return;
    }
    if (!config.portoneStoreId || !config.portoneChannelKey) {
      setError('본인인증 채널이 아직 설정되지 않았습니다. (포트원 계약·키 필요)');
      return;
    }
    // TODO: @portone/react-native-sdk 본인인증 — 계약 후 키가 나오면 붙인다.
    setError('포트원 SDK 연동이 아직 준비되지 않았습니다.');
  };

  const submitEmail = async () => {
    const method = signupConfig.data?.verification;
    if (isSignup && method === 'EMAIL_CODE' && !code.trim()) {
      setError('이메일로 받은 인증 코드를 입력해 주세요.');
      return;
    }
    if (isSignup && method === 'IDENTITY' && !identityId) {
      setError('휴대폰 본인인증을 먼저 완료해 주세요.');
      return;
    }
    if (isSignup && (!legalAgreed.terms || !legalAgreed.privacy)) {
      setError('이용약관과 개인정보 수집·이용 내용을 끝까지 읽고 동의해 주세요.');
      return;
    }
    setEmailLoading(true);
    setError(null);
    try {
      if (isSignup) {
        await emailSignup(
          email.trim(),
          password,
          nickname.trim(),
          method === 'EMAIL_CODE'
            ? { code: code.trim() }
            : method === 'IDENTITY'
              ? { identityVerificationId: identityId ?? undefined }
              : {},
          {
            termsAgreed: true,
            termsVersion: LEGAL_VERSION,
            privacyAgreed: true,
            privacyVersion: LEGAL_VERSION,
          },
        );
        await applyOnboardingPicks();
        router.replace('/home');
      } else {
        await emailLogin(email.trim(), password);
        router.replace('/home');
      }
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
      const newUser = await socialLogin('APPLE', credential.identityToken);
      if (newUser) {
        await applyOnboardingPicks();
      }
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
    if (!hasKakaoClient) {
      setError('카카오 로그인 키가 아직 설정되지 않았습니다. (.env.local의 EXPO_PUBLIC_KAKAO_REST_KEY)');
      return;
    }
    setSocialLoading('KAKAO');
    setError(null);
    try {
      const accessToken = await kakao.login();
      if (!accessToken) return; // 사용자가 취소
      const newUser = await socialLogin('KAKAO', accessToken);
      if (newUser) {
        await applyOnboardingPicks();
      }
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : '카카오 로그인에 실패했습니다.');
    } finally {
      setSocialLoading(null);
    }
  };

  const submitGoogle = async () => {
    if (!hasGoogleClient) {
      setError('Google 로그인 키가 아직 설정되지 않았습니다. (.env.local의 EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)');
      return;
    }
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
  const busy = emailLoading || socialLoading != null;
  const signupConsentComplete = legalAgreed.terms && legalAgreed.privacy;

  const openLegal = (key: LegalDocumentKey) => {
    setLegalOpen(key);
    setLegalReadToEnd(legalAgreed[key]);
  };

  const onLegalScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) {
      setLegalReadToEnd(true);
    }
  };

  const agreeCurrentLegal = () => {
    if (!legalOpen || !legalReadToEnd) return;
    setLegalAgreed((current) => ({ ...current, [legalOpen]: true }));
    setLegalOpen(null);
  };

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
            {isSignup && signupConfig.data?.verification === 'IDENTITY' ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>휴대폰 본인인증</Text>
                {identityId ? (
                  <View style={[styles.identityDone, { borderColor: darkColors.accent }]}>
                    <Text style={[typeScale.label, { color: darkColors.accent }]}>✓ 본인인증 완료</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={startIdentityVerification}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.identityButton, pressed && styles.pressed]}
                  >
                    <Text style={[typeScale.label, { color: darkColors.text }]}>
                      {signupConfig.data.identityDevStub
                        ? '휴대폰 본인인증 (개발용 즉시 통과)'
                        : '휴대폰 본인인증 하기'}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}
            {isSignup && signupConfig.data?.verification === 'EMAIL_CODE' ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>이메일 인증 코드</Text>
                <View style={styles.codeRow}>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="6자리"
                    placeholderTextColor={darkColors.textFaint}
                    accessibilityLabel="이메일 인증 코드"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                  />
                  <Pressable
                    onPress={requestCode}
                    disabled={busy || codeLoading}
                    style={({ pressed }) => [
                      styles.codeButton,
                      (pressed || busy || codeLoading) && styles.pressed,
                    ]}
                    accessibilityRole="button"
                  >
                    {codeLoading
                      ? <ActivityIndicator color={darkColors.text} />
                      : <Text style={styles.codeButtonLabel}>{codeSent ? '다시 받기' : '코드 받기'}</Text>}
                  </Pressable>
                </View>
                {codeSent ? (
                  <Text style={styles.codeHint}>이메일로 보낸 6자리 코드를 입력해 주세요. (10분 유효)</Text>
                ) : null}
              </View>
            ) : null}
            {isSignup ? (
              <View style={styles.legalBox}>
                <Text style={styles.legalHeading}>필수 동의</Text>
                {(['terms', 'privacy'] as const).map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => openLegal(key)}
                    style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${LEGAL_DOCUMENTS[key].title} 전문 보기`}
                  >
                    <View style={[styles.check, legalAgreed[key] && styles.checkDone]}>
                      <Text style={styles.checkLabel}>{legalAgreed[key] ? '✓' : ''}</Text>
                    </View>
                    <Text style={styles.legalRowLabel}>{LEGAL_DOCUMENTS[key].title}</Text>
                    <Text style={styles.legalView}>전문 보기 ›</Text>
                  </Pressable>
                ))}
                <Text style={styles.legalHint}>각 문서를 끝까지 읽어야 동의할 수 있습니다.</Text>
              </View>
            ) : null}
            <Pressable
              onPress={submitEmail}
              disabled={busy || (isSignup && !signupConsentComplete)}
              style={({ pressed }) => [
                styles.cta,
                (pressed || busy || (isSignup && !signupConsentComplete)) && styles.ctaDisabled,
              ]}
              accessibilityRole="button"
            >
              {emailLoading
                ? <ActivityIndicator color={darkColors.onAccent} />
                : <Text style={styles.ctaLabel}>{isSignup ? '이메일로 회원가입' : '이메일로 로그인'}</Text>}
            </Pressable>
            <Pressable
              onPress={() => { setIsSignup(!isSignup); setError(null); setCode(''); setCodeSent(false); setIdentityId(null); }}
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

          <View style={styles.divider}>
            <View style={styles.dividerRule} />
            <Text style={styles.dividerLabel}>또는</Text>
            <View style={styles.dividerRule} />
          </View>

          <View style={styles.social}>
            {showApple && Apple ? (
              <Apple.AppleAuthenticationButton
                buttonType={Apple.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={Apple.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={BUTTON_HEIGHT / 2}
                style={styles.appleButton}
                onPress={submitApple}
              />
            ) : null}
            <Pressable
              onPress={submitKakao}
              disabled={busy}
              style={({ pressed }) => [styles.kakaoButton, (pressed || busy) && styles.pressed]}
              accessibilityRole="button"
            >
              {socialLoading === 'KAKAO'
                ? <ActivityIndicator color="#191919" />
                : <Text style={styles.kakaoLabel}>카카오로 계속하기</Text>}
            </Pressable>
            <Pressable
              onPress={submitGoogle}
              disabled={busy}
              style={({ pressed }) => [styles.googleButton, (pressed || busy) && styles.pressed]}
              accessibilityRole="button"
            >
              {socialLoading === 'GOOGLE'
                ? <ActivityIndicator color={darkColors.text} />
                : <Text style={styles.googleLabel}>Google로 계속하기</Text>}
            </Pressable>
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
      <Modal
        visible={legalOpen != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLegalOpen(null)}
      >
        <View style={styles.legalModal}>
          <View style={styles.legalModalHeader}>
            <Text style={styles.legalModalTitle}>
              {legalOpen ? LEGAL_DOCUMENTS[legalOpen].title : ''}
            </Text>
            <Pressable onPress={() => setLegalOpen(null)} accessibilityRole="button" hitSlop={12}>
              <Text style={styles.legalClose}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.legalScroll}
            contentContainerStyle={styles.legalContent}
            onScroll={onLegalScroll}
            scrollEventThrottle={16}
          >
            <Text style={styles.legalBody}>{legalOpen ? LEGAL_DOCUMENTS[legalOpen].body : ''}</Text>
            <Text style={styles.legalEnd}>— 문서의 끝 —</Text>
          </ScrollView>
          <View style={styles.legalFooter}>
            {!legalReadToEnd ? (
              <Text style={styles.legalScrollHint}>내용을 끝까지 내려 읽어 주세요.</Text>
            ) : null}
            <Pressable
              onPress={agreeCurrentLegal}
              disabled={!legalReadToEnd}
              style={[styles.legalAgree, !legalReadToEnd && styles.legalAgreeDisabled]}
              accessibilityRole="button"
            >
              <Text style={styles.legalAgreeLabel}>
                {legalOpen && legalAgreed[legalOpen] ? '동의 완료' : '읽었으며 동의합니다'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
  error: { ...typeScale.caption, color: darkColors.danger },
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
  codeHint: { ...typeScale.caption, color: darkColors.textFaint },
  identityButton: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.md,
    borderWidth: hairline,
    borderColor: darkColors.lineStrong,
    backgroundColor: darkColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityDone: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.md,
    borderWidth: hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalBox: {
    borderWidth: hairline,
    borderColor: darkColors.lineStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  legalHeading: { ...typeScale.label, color: darkColors.text },
  legalRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: darkColors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: darkColors.accent, borderColor: darkColors.accent },
  checkLabel: { color: darkColors.onAccent, fontSize: 13, fontWeight: '700' },
  legalRowLabel: { ...typeScale.caption, color: darkColors.text, flex: 1 },
  legalView: { ...typeScale.caption, color: darkColors.textMuted },
  legalHint: { ...typeScale.caption, color: darkColors.textFaint },
  legalModal: { flex: 1, backgroundColor: darkColors.bg },
  legalModalHeader: {
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: darkColors.lineStrong,
  },
  legalModalTitle: { ...typeScale.bodyStrong, color: darkColors.text, flex: 1 },
  legalClose: { ...typeScale.label, color: darkColors.textMuted },
  legalScroll: { flex: 1 },
  legalContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  legalBody: { ...typeScale.body, color: darkColors.textMuted, lineHeight: 25 },
  legalEnd: { ...typeScale.caption, color: darkColors.textFaint, textAlign: 'center', marginTop: spacing.xl },
  legalFooter: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: hairline,
    borderTopColor: darkColors.lineStrong,
  },
  legalScrollHint: { ...typeScale.caption, color: darkColors.textFaint, textAlign: 'center' },
  legalAgree: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.sm,
    backgroundColor: darkColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalAgreeDisabled: { opacity: 0.35 },
  legalAgreeLabel: { ...typeScale.bodyStrong, color: darkColors.onAccent },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividerRule: { flex: 1, height: hairline, backgroundColor: darkColors.lineStrong },
  dividerLabel: { ...typeScale.caption, color: darkColors.textFaint },
  social: { gap: spacing.sm },
  appleButton: { height: BUTTON_HEIGHT, width: '100%' },
  kakaoButton: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.sm,
    backgroundColor: '#FEE500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoLabel: { ...typeScale.bodyStrong, color: '#191919' },
  googleButton: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: darkColors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLabel: { ...typeScale.bodyStrong, color: darkColors.text },
  pressed: pressedStyle,
  devInfo: { gap: spacing.sm },
  devRule: { height: hairline, backgroundColor: darkColors.line },
  devLine: { ...typeScale.caption, color: darkColors.textFaint, fontVariant: ['tabular-nums'] },
});
