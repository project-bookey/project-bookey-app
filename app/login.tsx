import * as Google from 'expo-auth-session/providers/google';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent,
} from 'react-native';

import { useQuery } from '@tanstack/react-query';

import { API_BASE_URL, ApiError } from '@/api/client';
import type { SignupConsent } from '@/api/types';
import { authApi, libraryApi } from '@/api/endpoints';
import { useOnboarding } from '@/store/onboarding';
import { hasKakaoClient, useKakaoLogin } from '@/hooks/useKakaoLogin';
// 공급자 설정(애플 모듈·구글 클라이언트 ID)은 설정의 '소셜 계정 연동'과 한 곳에서 나눠 쓴다.
import { Apple, googleClientIds, hasGoogleClient, type SocialProvider } from '@/hooks/useSocialTokens';
import { useSecondsLeft } from '@/hooks/useSecondsLeft';
import { useAuth } from '@/store/auth';
import { darkColors, hairline, pressedStyle, radius, sans, spacing, typeScale } from '@/theme';
import {
  consentComplete, EMPTY_CONSENT, SignupConsentBox, toSignupConsent, type ConsentDraft,
} from '@/components/legal/SignupConsentBox';
import { SocialConsentSheet } from '@/components/legal/SocialConsentSheet';
import { CODE_EXPIRED_MESSAGE, FieldError, isEmail, TimedCodeInput } from '@/components/auth/authFields';
import { KeyboardArea } from '@/components/keyboard';
import { linkLabel } from '@/components/ui';

WebBrowser.maybeCompleteAuthSession();


const BUTTON_HEIGHT = 48;

/** 경고를 띄우는 자리 — 칸 하나에 걸리는 오류는 그 칸 밑에, 어느 칸에도 걸리지 않는 오류(로그인 실패·소셜 등)는 버튼 바로 위(form)에. */
type FieldSpot = 'email' | 'nickname' | 'password' | 'identity' | 'code';
type ErrorSpot = FieldSpot | 'form';
type FormErrors = Partial<Record<ErrorSpot, string>>;

/** 화면에 놓인 순서 — 경고가 여럿이면 맨 위 칸으로 스크롤한다. */
const FIELD_ORDER: FieldSpot[] = ['email', 'nickname', 'password', 'identity', 'code'];

/** 서버 오류 코드가 가리키는 칸. 여기 없는 코드(또는 지금 화면에 없는 칸)는 부른 쪽이 정한 자리에 둔다. */
const SERVER_ERROR_SPOT: Record<string, FieldSpot> = {
  EMAIL_ALREADY_EXISTS: 'email',
  EMAIL_REJOIN_BLOCKED: 'email',
  NICKNAME_ALREADY_EXISTS: 'nickname',
  EMAIL_CODE_INVALID: 'code',
  EMAIL_CODE_EXPIRED: 'code',
  IDENTITY_VERIFICATION_REQUIRED: 'identity',
  IDENTITY_VERIFICATION_FAILED: 'identity',
  IDENTITY_ALREADY_REGISTERED: 'identity',
};

/**
 * 로그인 — 다크 고정, 심플 플랫 레이아웃 (사용자 결정: 그라데이션 대신 이전 구성 유지).
 * 이메일 폼이 주인공, 소셜(애플·카카오·구글)은 보조. 연동된 소셜 계정은 그 계정으로 로그인되고, 처음 보는
 * 소셜 계정은 서버가 LEGAL_CONSENT_REQUIRED 로 돌려보낸다 — 가입 동의 시트(SocialConsentSheet)에서 동의를 받아
 * 같은 토큰으로 다시 부르면 그때 가입된다(newUser — 이메일 가입과 같은 가입 마무리를 거친다).
 * 가입 동의(약관·개인정보·만 14세 필수, 광고성 정보 선택)의 원문은 서버가 내려준다(SignupConsentBox).
 * 가입 인증은 서버 설정(signup-config)을 따른다 — IDENTITY, EMAIL_CODE 또는 NONE.
 * 가입 성공 시 온보딩에서 고른 카테고리·책을 반영하고 프로필 기본 정보 단계(/profile-photo)를 거쳐 홈으로 간다.
 * 비밀번호를 잊은 사람은 비밀번호 칸 아래 링크로 /password-reset 에 간다(입력해 둔 이메일을 넘긴다).
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
  const [codeVerifyLoading, setCodeVerifyLoading] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  /** 보낸 코드를 입력할 수 있는 마지막 시각(ms) — 서버가 알려 준 시간으로 센다. */
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [codeValidMinutes, setCodeValidMinutes] = useState(3);
  const codeLeft = useSecondsLeft(codeExpiresAt);
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
  const [errors, setErrors] = useState<FormErrors>({});
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [consent, setConsent] = useState<ConsentDraft>(EMPTY_CONSENT);
  /** 동의를 기다리는 처음 보는 소셜 계정 — 동의하면 이 토큰으로 다시 로그인을 부른다. */
  const [pendingSocial, setPendingSocial] = useState<{ provider: SocialProvider; token: string } | null>(null);
  const [socialConsentBusy, setSocialConsentBusy] = useState(false);
  const [socialConsentError, setSocialConsentError] = useState<string | null>(null);

  const kakao = useKakaoLogin();

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const formY = useRef(0);
  const fieldY = useRef<Partial<Record<FieldSpot, number>>>({});
  const trackField = (spot: FieldSpot) => (e: LayoutChangeEvent) => {
    fieldY.current[spot] = e.nativeEvent.layout.y;
  };

  /** 한 자리의 경고만 바꾼다(null 이면 지운다) — 다른 칸에 떠 있는 경고는 그대로 둔다. */
  const putError = (spot: ErrorSpot, message: string | null) => setErrors((prev) => {
    if ((prev[spot] ?? null) === message) return prev;
    const next = { ...prev };
    if (message) next[spot] = message;
    else delete next[spot];
    return next;
  });
  const setFormError = (message: string | null) => putError('form', message);

  /** 지금 화면에 있는 칸인지 — 가입 폼에만 있는 칸, 인증 방식에 따라 생기는 칸이 있다. */
  const fieldShown = (spot: FieldSpot) => {
    const method = signupConfig.data?.verification;
    switch (spot) {
      case 'email':
      case 'password':
        return true;
      case 'nickname':
        return isSignup;
      case 'identity':
        return isSignup && method === 'IDENTITY';
      case 'code':
        return isSignup && method === 'EMAIL_CODE';
    }
  };
  const errorSpotOf = (e: unknown, fallback: ErrorSpot): ErrorSpot => {
    const spot = e instanceof ApiError ? SERVER_ERROR_SPOT[e.code] : undefined;
    return spot && fieldShown(spot) ? spot : fallback;
  };

  /**
   * 경고가 뜬 맨 위 칸이 화면 위로 지나가 있으면 그 칸까지 올린다 — 가입 폼은 길어서, 동의 상자 밑 버튼을 누른 자리에서는
   * 맨 위 이메일 칸이 보이지 않는다. 이미 보이는 칸이면 움직이지 않는다.
   */
  const revealFirstError = (found: FormErrors) => {
    const first = FIELD_ORDER.find((spot) => found[spot]);
    const y = first ? fieldY.current[first] : undefined;
    if (y == null) return;
    const top = Math.max(formY.current + y - spacing.lg, 0);
    if (top < scrollY.current) {
      scrollRef.current?.scrollTo({ y: top, animated: true });
    }
  };

  /** 경고 하나를 띄우고 그 칸이 보이게 한다 — '코드 받기'를 누른 자리에서 이메일 칸이 위로 지나가 있을 수 있다. */
  const flagError = (spot: ErrorSpot, message: string) => {
    putError(spot, message);
    revealFirstError({ [spot]: message });
  };

  useEffect(() => {
    Apple?.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    ...googleClientIds,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    const idToken = googleResponse?.type === 'success' ? googleResponse.params.id_token : undefined;
    if (!idToken) {
      if (googleResponse?.type === 'error') {
        setFormError('Google 로그인을 마치지 못했어요. 다시 시도해 주세요.');
      }
      if (googleResponse) {
        setSocialLoading(null);
      }
      return;
    }
    setSocialLoading('GOOGLE');
    setFormError(null);
    runSocial('GOOGLE', idToken)
      .catch((e) => setFormError(e instanceof Error ? e.message : 'Google 로그인을 마치지 못했어요. 다시 시도해 주세요.'))
      .finally(() => setSocialLoading(null));
  }, [googleResponse, router, socialLogin]);

  const requestCode = async () => {
    const normalizedEmail = email.trim();
    putError('code', null);
    if (!normalizedEmail || !isEmail(normalizedEmail)) {
      flagError('email', normalizedEmail ? '이메일 주소를 다시 확인해 주세요.' : '이메일을 먼저 입력해 주세요.');
      return;
    }
    setCodeLoading(true);
    setCodeVerified(false);
    putError('email', null);
    // 입력 마감은 요청을 보낸 때부터 센다 — 서버보다 늦게 끝나 '0:01'에 낸 코드가 거절되지 않게.
    const requestedAt = Date.now();
    try {
      const result = await authApi.requestEmailCode(normalizedEmail);
      setCodeSent(true);
      setCodeExpiresAt(requestedAt + result.expiresInSec * 1000);
      setCodeValidMinutes(Math.max(1, Math.round(result.expiresInSec / 60)));
      // 새 코드가 앞 코드를 대신하므로 칸을 비운다. 로컬 서버는 devCode 를 동봉한다 — 개발 편의로 자동 입력.
      setCode(result.devCode ?? '');
    } catch (e) {
      flagError(errorSpotOf(e, 'code'), e instanceof Error ? e.message : '인증 코드를 보내지 못했어요.');
    } finally {
      setCodeLoading(false);
    }
  };

  const verifyCode = async () => {
    const normalizedEmail = email.trim();
    const normalizedCode = code.trim();
    if (!normalizedEmail) {
      flagError('email', '이메일을 먼저 입력해 주세요.');
      return;
    }
    if (normalizedCode.length !== 6) {
      putError('code', '이메일로 받은 6자리 코드를 입력해 주세요.');
      return;
    }
    setCodeVerifyLoading(true);
    putError('code', null);
    try {
      await authApi.verifyEmailCode(normalizedEmail, normalizedCode);
      setCodeVerified(true);
    } catch (e) {
      setCodeVerified(false);
      flagError(errorSpotOf(e, 'code'), e instanceof Error ? e.message : '인증 코드를 확인하지 못했어요.');
    } finally {
      setCodeVerifyLoading(false);
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

  /**
   * 새 계정의 마무리 — 온보딩 선택을 반영하고 프로필 기본 정보(성별·생년월일·사진) 단계로 보낸다.
   * 그 화면에서 '나중에 하기'로 바로 홈에 갈 수 있다. 기존 계정 로그인은 곧장 홈으로 간다.
   */
  const finishSignup = async () => {
    await applyOnboardingPicks();
    router.replace('/profile-photo');
  };

  /**
   * 소셜 로그인 공통 — 연동된 계정은 홈으로, 새 계정은 가입 마무리로.
   * 처음 보는 계정이라 서버가 동의를 요구하면 가입 동의 시트를 띄우고 토큰을 들고 기다린다.
   */
  const runSocial = async (provider: SocialProvider, token: string) => {
    try {
      const newUser = await socialLogin(provider, token);
      if (newUser) {
        await finishSignup();
        return;
      }
      router.replace('/home');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'LEGAL_CONSENT_REQUIRED') {
        setSocialConsentError(null);
        setPendingSocial({ provider, token });
        return;
      }
      throw e;
    }
  };

  /** 소셜 가입 동의 시트의 '동의하고 가입' — 기다리던 토큰으로 동의와 함께 다시 부른다. */
  const completeSocialSignup = async (signupConsent: SignupConsent) => {
    if (!pendingSocial) return;
    setSocialConsentBusy(true);
    setSocialConsentError(null);
    try {
      const newUser = await socialLogin(pendingSocial.provider, pendingSocial.token, signupConsent);
      setPendingSocial(null);
      if (newUser) {
        await finishSignup();
        return;
      }
      router.replace('/home');
    } catch (e) {
      // 소셜 토큰은 몇 분 뒤 만료된다(Apple 은 약 10분) — 그때는 처음부터 다시 로그인하게 안내한다.
      setSocialConsentError(e instanceof ApiError && e.status === 401
        ? '로그인 정보가 만료됐어요. 취소한 뒤 다시 로그인해 주세요.'
        : e instanceof Error ? e.message : '가입하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSocialConsentBusy(false);
    }
  };

  /** 본인인증 시작 — 개발 스텁이면 즉시 통과, 실서비스는 포트원 SDK 연동 지점. */
  const startIdentityVerification = () => {
    const config = signupConfig.data;
    if (!config) return;
    putError('identity', null);
    if (config.identityDevStub) {
      setIdentityId(`dev-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`);
      return;
    }
    if (!config.portoneStoreId || !config.portoneChannelKey) {
      putError('identity', __DEV__
        ? '본인인증 채널이 아직 설정되지 않았어요. (포트원 계약·키 필요)'
        : '지금은 휴대폰 본인인증을 할 수 없어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    // TODO: @portone/react-native-sdk 본인인증 — 계약 후 키가 나오면 붙인다.
    putError('identity', __DEV__
      ? '포트원 SDK 연동이 아직 준비되지 않았어요.'
      : '지금은 휴대폰 본인인증을 할 수 없어요. 잠시 후 다시 시도해 주세요.');
  };

  const submitEmail = async () => {
    const method = signupConfig.data?.verification;
    const normalizedEmail = email.trim();
    const normalizedNickname = nickname.trim();
    // 잘못된 칸을 한 번에 모두 짚는다 — 하나 고치고 다시 눌러야 다음 칸 경고가 보이지 않게.
    const found: FormErrors = {};
    if (!isEmail(normalizedEmail)) {
      found.email = '이메일 주소를 다시 확인해 주세요.';
    }
    if (isSignup && (!normalizedNickname || normalizedNickname.length > 50)) {
      found.nickname = '닉네임을 50자 안으로 적어 주세요.';
    }
    if (password.length < 8 || password.length > 72) {
      found.password = '비밀번호는 8~72자로 정해 주세요.';
    }
    if (isSignup && method === 'IDENTITY' && !identityId) {
      found.identity = '휴대폰 본인인증을 먼저 해 주세요.';
    }
    if (isSignup && method === 'EMAIL_CODE' && !code.trim()) {
      found.code = '이메일로 받은 인증 코드를 입력해 주세요.';
    } else if (isSignup && method === 'EMAIL_CODE' && !codeVerified) {
      found.code = '이메일 인증 코드를 먼저 확인해 주세요.';
    }
    if (isSignup && !consentComplete(consent)) {
      found.form = '필수 항목(만 14세 이상, 이용약관, 개인정보 수집·이용)에 모두 동의해 주세요.';
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      revealFirstError(found);
      return;
    }
    setEmailLoading(true);
    try {
      if (isSignup) {
        await emailSignup(
          normalizedEmail,
          password,
          normalizedNickname,
          method === 'EMAIL_CODE'
            ? { code: code.trim() }
            : method === 'IDENTITY'
              ? { identityVerificationId: identityId ?? undefined }
              : {},
          toSignupConsent(consent),
        );
        await finishSignup();
      } else {
        await emailLogin(email.trim(), password);
        router.replace('/home');
      }
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'EMAIL_CODE_EXPIRED' || e.code === 'EMAIL_CODE_INVALID')) {
        setCodeVerified(false);
      }
      const fallback = isSignup ? '가입하지 못했어요. 다시 시도해 주세요.' : '로그인하지 못했어요. 다시 시도해 주세요.';
      flagError(errorSpotOf(e, 'form'), e instanceof Error ? e.message : fallback);
    } finally {
      setEmailLoading(false);
    }
  };

  const submitApple = async () => {
    if (!Apple || busy) return; // 네이티브 버튼엔 disabled가 없어 진행 중 중복 실행을 여기서 막는다

    setSocialLoading('APPLE');
    setFormError(null);
    try {
      const credential = await Apple.signInAsync({
        requestedScopes: [
          Apple.AppleAuthenticationScope.FULL_NAME,
          Apple.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple 로그인을 마치지 못했어요. 다시 시도해 주세요.');
      }
      await runSocial('APPLE', credential.identityToken);
    } catch (e) {
      if ((e as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') {
        setFormError(e instanceof Error ? e.message : 'Apple 로그인을 마치지 못했어요. 다시 시도해 주세요.');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const submitKakao = async () => {
    if (!hasKakaoClient) {
      setFormError(__DEV__
        ? '카카오 로그인 키가 아직 설정되지 않았어요. (.env.local의 EXPO_PUBLIC_KAKAO_REST_KEY)'
        : '지금은 카카오 로그인을 쓸 수 없어요.');
      return;
    }
    setSocialLoading('KAKAO');
    setFormError(null);
    try {
      const accessToken = await kakao.login();
      if (!accessToken) return; // 사용자가 취소
      await runSocial('KAKAO', accessToken);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '카카오 로그인을 마치지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSocialLoading(null);
    }
  };

  const submitGoogle = async () => {
    if (!hasGoogleClient) {
      setFormError(__DEV__
        ? 'Google 로그인 키가 아직 설정되지 않았어요. (.env.local의 EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)'
        : '지금은 Google 로그인을 쓸 수 없어요.');
      return;
    }
    setSocialLoading('GOOGLE');
    setFormError(null);
    try {
      await promptGoogle();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Google 로그인 창을 열지 못했어요.');
      setSocialLoading(null);
    }
  };

  const showApple = Boolean(Apple) && appleAvailable;
  const busy = emailLoading || codeLoading || codeVerifyLoading || socialLoading != null;
  const signupConsentComplete = consentComplete(consent);
  const signupVerificationComplete = signupConfig.data?.verification !== 'EMAIL_CODE' || codeVerified;
  const codeTiming = codeSent && !codeVerified;
  const codeExpired = codeTiming && codeLeft === 0;
  const codeError = errors.code ?? (codeExpired ? CODE_EXPIRED_MESSAGE : undefined);

  return (
    <View style={styles.screen}>
      <KeyboardArea>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
        >
          <View>
            <Text style={styles.wordmark}>bookey</Text>
            <View style={styles.wordmarkRule} />
          </View>

          <View style={styles.form} onLayout={(e) => { formY.current = e.nativeEvent.layout.y; }}>
            {/* 칸에 걸린 경고는 그 칸 밑에 — 테두리도 붉게 바꾸고, 그 칸을 고치기 시작하면 지운다(Proximity). */}
            <View style={styles.field} onLayout={trackField('email')}>
              <Text style={styles.fieldLabel}>이메일</Text>
              <TextInput
                style={[styles.input, errors.email ? styles.inputError : null]}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setCodeVerified(false);
                  putError('email', null);
                  // 보낸 코드는 앞 이메일 것이라 새 이메일로 다시 받게 한다(서버 대기 시간도 이메일마다 따로다).
                  if (codeSent) {
                    setCodeSent(false);
                    setCode('');
                    setCodeExpiresAt(null);
                    putError('code', null);
                  }
                }}
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
              <FieldError colors={darkColors} message={errors.email} />
            </View>
            {isSignup ? (
              <View style={styles.field} onLayout={trackField('nickname')}>
                <Text style={styles.fieldLabel}>닉네임</Text>
                <TextInput
                  style={[styles.input, errors.nickname ? styles.inputError : null]}
                  value={nickname}
                  onChangeText={(value) => {
                    setNickname(value);
                    putError('nickname', null);
                  }}
                  maxLength={50}
                  placeholder="독서가"
                  placeholderTextColor={darkColors.textFaint}
                  accessibilityLabel="닉네임"
                  textContentType="nickname"
                />
                <FieldError colors={darkColors} message={errors.nickname} />
              </View>
            ) : null}
            <View style={styles.field} onLayout={trackField('password')}>
              <Text style={styles.fieldLabel}>비밀번호</Text>
              <TextInput
                style={[styles.input, errors.password ? styles.inputError : null]}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  putError('password', null);
                }}
                secureTextEntry
                placeholder="8자 이상"
                placeholderTextColor={darkColors.textFaint}
                accessibilityLabel="비밀번호"
                textContentType={isSignup ? 'newPassword' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
              <FieldError colors={darkColors} message={errors.password} />
              {/* 비밀번호를 잊었을 때의 길은 비밀번호 칸 바로 아래 — 흔한 자리(Jakob)이자 그 칸과 한 묶음(Proximity). */}
              {!isSignup ? (
                <Pressable
                  onPress={() => router.push({
                    pathname: '/password-reset',
                    params: email.trim() ? { email: email.trim() } : {},
                  })}
                  disabled={busy}
                  hitSlop={{ top: 0, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.forgot, pressed && styles.pressed]}
                >
                  <Text style={styles.forgotLabel}>{linkLabel('비밀번호 찾기')}</Text>
                </Pressable>
              ) : null}
            </View>
            {isSignup && signupConfig.data?.verification === 'IDENTITY' ? (
              <View style={styles.field} onLayout={trackField('identity')}>
                <Text style={styles.fieldLabel}>휴대폰 본인인증</Text>
                {identityId ? (
                  <View style={[styles.identityDone, { borderColor: darkColors.accent }]}>
                    <Text style={[typeScale.label, { color: darkColors.accent }]}>✓ 본인인증 완료</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={startIdentityVerification}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.identityButton,
                      errors.identity ? styles.inputError : null,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[typeScale.label, { color: darkColors.text }]}>
                      {signupConfig.data.identityDevStub
                        ? '휴대폰 본인인증 (개발용 즉시 통과)'
                        : '휴대폰 본인인증 하기'}
                    </Text>
                  </Pressable>
                )}
                <FieldError colors={darkColors} message={errors.identity} />
              </View>
            ) : null}
            {isSignup && signupConfig.data?.verification === 'EMAIL_CODE' ? (
              <View style={styles.field} onLayout={trackField('code')}>
                <Text style={styles.fieldLabel}>이메일 인증 코드</Text>
                <View style={styles.codeRow}>
                  {/* 입력 마감까지 남은 시간은 칸 안 오른쪽 — 끝나면 붉게 바뀌고 칸 밑에 다시 받으라는 경고가 뜬다. */}
                  <TimedCodeInput
                    colors={darkColors}
                    inputStyle={styles.input}
                    timing={codeTiming}
                    secondsLeft={codeLeft}
                    error={codeError}
                    value={code}
                    onChangeText={(value) => {
                      setCode(value);
                      setCodeVerified(false);
                      putError('code', null);
                    }}
                    accessibilityLabel="이메일 인증 코드"
                  />
                  {/* 다시 받기는 기다림 없이 바로 열려 있다(사용자 결정) — 남용은 서버가 1시간 횟수 상한으로 막는다. */}
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
                <FieldError colors={darkColors} message={codeError} />
                {codeSent ? (
                  <>
                    <Pressable
                      onPress={verifyCode}
                      disabled={busy || codeVerifyLoading || code.length !== 6 || codeVerified || codeExpired}
                      style={({ pressed }) => [
                        styles.identityButton,
                        (pressed || busy || codeVerifyLoading || codeVerified || codeExpired) && styles.pressed,
                      ]}
                      accessibilityRole="button"
                    >
                      {codeVerifyLoading
                        ? <ActivityIndicator color={darkColors.text} />
                        : <Text style={[typeScale.label, { color: codeVerified ? darkColors.accent : darkColors.text }]}>
                            {codeVerified ? '✓ 이메일 인증 완료' : '인증 코드 확인'}
                          </Text>}
                    </Pressable>
                    {!codeVerified ? (
                      <Text style={styles.codeHint}>이메일로 보낸 6자리 코드를 {codeValidMinutes}분 안에 입력해 주세요.</Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}
            {isSignup ? (
              <SignupConsentBox colors={darkColors} value={consent} onChange={setConsent} disabled={busy} />
            ) : null}
            {/* 어느 칸에도 걸리지 않는 실패(로그인 실패·소셜 등)는 누른 버튼 바로 위에 — 아래 '회원가입' 밑에 두면 눈이 닿지 않는다. */}
            <FieldError colors={darkColors} message={errors.form} />
            <Pressable
              onPress={submitEmail}
              disabled={busy || (isSignup && (!signupConsentComplete || !signupVerificationComplete))}
              style={({ pressed }) => [
                styles.cta,
                (pressed || busy || (isSignup && (!signupConsentComplete || !signupVerificationComplete))) && styles.ctaDisabled,
              ]}
              accessibilityRole="button"
            >
              {emailLoading
                ? <ActivityIndicator color={darkColors.onAccent} />
                : <Text style={styles.ctaLabel}>{isSignup ? '이메일로 회원가입' : '이메일로 로그인'}</Text>}
            </Pressable>
            <Pressable
              onPress={() => {
                setIsSignup(!isSignup);
                setErrors({});
                setCode('');
                setCodeSent(false);
                setCodeExpiresAt(null);
                setCodeVerified(false);
                setIdentityId(null);
              }}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
            >
              <Text style={styles.ghostLabel}>
                {isSignup ? '로그인으로 돌아가기' : '회원가입'}
              </Text>
            </Pressable>
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
      </KeyboardArea>
      <SocialConsentSheet
        visible={pendingSocial != null}
        colors={darkColors}
        busy={socialConsentBusy}
        error={socialConsentError}
        onCancel={() => setPendingSocial(null)}
        onSubmit={completeSocialSignup}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: darkColors.bg },
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
  inputError: { borderColor: darkColors.danger },
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
  // 가입으로 가는 유일한 길 — 글자만 있던 때는 눈에 띄지 않아 테두리 버튼으로 둔다(주요 버튼 아래 보조 버튼).
  ghost: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: darkColors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { ...typeScale.label, color: darkColors.text },
  // 겉 높이 32 + 아래 hitSlop 12 = 44pt. 위는 비밀번호 칸과 겹치지 않게 넓히지 않는다.
  forgot: { alignSelf: 'flex-end', paddingVertical: spacing.sm },
  forgotLabel: { ...typeScale.caption, color: darkColors.textMuted },
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
  codeHint: { ...typeScale.caption, color: darkColors.textFaint },
  identityButton: {
    minHeight: BUTTON_HEIGHT,
    borderRadius: radius.md,
    borderWidth: hairline,
    borderColor: darkColors.control,
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
    borderColor: darkColors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLabel: { ...typeScale.bodyStrong, color: darkColors.text },
  pressed: pressedStyle,
  devInfo: { gap: spacing.sm },
  devRule: { height: hairline, backgroundColor: darkColors.line },
  devLine: { ...typeScale.caption, color: darkColors.textFaint, fontVariant: ['tabular-nums'] },
});
