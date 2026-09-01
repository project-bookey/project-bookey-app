# 로그인 리디자인 + 소셜 3종 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 화면을 다크 틸 그라데이션 OTT 디자인으로 리라이트하고 카카오·애플·구글 소셜 로그인을 실작동 연결, 백엔드의 깨진 본문 500 결함 수정과 시드 계정 비밀번호 부여.

**Architecture:** 스펙 `docs/superpowers/specs/2026-09-01-login-redesign-design.md`. 앱은 화면 로컬 프리미티브 + 새 토큰만 사용(레거시 `ui.tsx`·`colors/type/fonts` 금지). 카카오는 `expo-auth-session` 제네릭 코드 플로우 훅, 애플은 `expo-apple-authentication` 조건부 require. 백엔드는 `GlobalExceptionHandler`에 400 매핑 1건 + 시드 SQL.

**Tech Stack:** Expo SDK 57 / expo-auth-session / expo-apple-authentication(신규) / zustand / Spring Boot 4.1.1

## Global Constraints

- 새 코드는 `useTheme/darkColors/typeScale/sans/spacing/radius/hairline/layout/statusLabel/ColorTokens`만 사용. 레거시 `colors/type/fonts/elevation/ornament` 및 `ui.tsx` 컴포넌트(`Screen/Button/Field/Rule` 등) 금지.
- 커밋 메시지 한국어, "신규:"/"수정:" 접두. **AI 어트리뷰션(Co-Authored-By 등) 절대 금지.**
- 앱 검증: `npm run typecheck` exit 0. 백엔드 검증: `JAVA_HOME='C:\Users\ANT010\.jdks\corretto-21.0.7' ./mvnw -q test` (server/ 디렉터리, 전부 통과).
- 백엔드 저장소: `D:\Develop\workspace\myproject\project-bookey-backend`, 브랜치 `feature/email-auth-fix`. 앱 저장소: `D:\Develop\workspace\myproject\project-bookey-app`, 브랜치 `feature/login-redesign`.
- 카카오 버튼 색: 배경 `#FEE500`, 텍스트 `#191919` (브랜드 고정값 — 팔레트 토큰 아님).

---

### Task 1: 팔레트 승격 + 스토어 제네릭 socialLogin (앱)

**Files:**
- Modify: `src/theme/palette.ts` (파일 끝 근처, `darkColors` 정의 이후)
- Modify: `src/theme/index.ts:7`
- Modify: `app/book/[id].tsx:213` 부근
- Modify: `src/store/auth.ts`

**Interfaces:**
- Produces: `brandGradientStops: readonly [string, string, string]` (`@/theme`에서 import 가능), `useAuth().socialLogin(provider: 'GOOGLE'|'APPLE'|'KAKAO', token: string, nickname?: string): Promise<void>` (`googleLogin` 삭제됨)

- [ ] **Step 1: palette.ts에 brandGradientStops 추가** (`darkColors` 정의 뒤)

```ts
/** 브랜드 틸 그라데이션 — 무표지 도서 배경·로그인 배경 등 브랜드 표면 공용. */
export const brandGradientStops = ['#1B4A3E', darkColors.accentSoft, '#0D1F1B'] as const;
```

- [ ] **Step 2: index.ts export에 추가** — 7행을 다음으로 교체

```ts
export { brandGradientStops, darkColors, lightColors, cardShadow, getLagStyle, getPaceStyle } from './palette';
```

- [ ] **Step 3: book/[id].tsx 로컬 상수 제거** — `const FALLBACK_BG_STOPS = ['#1B4A3E', darkColors.accentSoft, '#0D1F1B'] as const;` 줄을 삭제하고, 사용처 `colors={[...FALLBACK_BG_STOPS]}` → `colors={[...brandGradientStops]}`. 파일 상단 `@/theme` import에 `brandGradientStops` 추가.

- [ ] **Step 4: auth.ts 스토어 교체** — `AuthState`의 `googleLogin: (idToken: string) => Promise<void>;`를 아래로 교체하고 구현부도 교체:

```ts
socialLogin: (provider: 'GOOGLE' | 'APPLE' | 'KAKAO', token: string, nickname?: string) => Promise<void>;
```

```ts
socialLogin: async (provider, token, nickname) => {
  const result = await authApi.socialLogin(provider, token, nickname);
  await setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  set({ user: result.user, status: 'authenticated' });
},
```

주의: `app/login.tsx`가 `googleLogin`을 참조하므로 이 시점엔 typecheck가 깨진다 — Task 3에서 해소. 이 태스크에서는 `npx tsc --noEmit 2>&1 | grep -v "app/login.tsx"`로 login.tsx 외 오류 0 확인.

- [ ] **Step 5: 커밋** — `수정: 브랜드 그라데이션 팔레트 승격·소셜 로그인 스토어 일반화`

---

### Task 2: 카카오 훅 + 애플 설치·설정 (앱)

**Files:**
- Create: `src/hooks/useKakaoLogin.ts`
- Modify: `app.json`, `package.json`(expo install이 수정)

**Interfaces:**
- Produces: `useKakaoLogin(): { ready: boolean; login: () => Promise<string | null> }` — login()은 성공 시 카카오 accessToken, 사용자가 취소하면 null, 실패 시 throw. `hasKakaoClient: boolean` (모듈 상수 export).

- [ ] **Step 1: 애플 모듈 설치**

Run: `npx expo install expo-apple-authentication`
Expected: package.json에 `"expo-apple-authentication": "~57.x"` 추가

- [ ] **Step 2: app.json 설정** — `expo.ios`에 `"usesAppleSignIn": true` 추가, `expo.plugins` 배열에 `"expo-apple-authentication"` 추가.

- [ ] **Step 3: useKakaoLogin.ts 작성**

```ts
import { exchangeCodeAsync, makeRedirectUri, ResponseType, useAuthRequest } from 'expo-auth-session';

/**
 * 카카오 OAuth 코드 플로우 (공식 Expo 모듈 없음 — REST 방식).
 * 백엔드 /auth/social(KAKAO)은 kapi.kakao.com을 조회하므로 accessToken을 넘긴다.
 * 카카오 문서 플로우에는 PKCE가 없어 usePKCE를 끈다. Client Secret은 콘솔 OFF 전제.
 */
const discovery = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
};

const clientId = process.env.EXPO_PUBLIC_KAKAO_REST_KEY ?? '';

export const hasKakaoClient = Boolean(clientId);

export function useKakaoLogin() {
  const redirectUri = makeRedirectUri({ scheme: 'bookey', path: 'auth/kakao' });
  const [request, , promptAsync] = useAuthRequest(
    { clientId: clientId || 'not-configured', redirectUri, responseType: ResponseType.Code, usePKCE: false },
    discovery,
  );

  /** 성공 시 카카오 accessToken, 사용자가 창을 닫으면 null. */
  const login = async (): Promise<string | null> => {
    const result = await promptAsync();
    if (result.type === 'cancel' || result.type === 'dismiss') return null;
    if (result.type !== 'success' || !result.params.code) {
      throw new Error('카카오 로그인에 실패했습니다.');
    }
    const token = await exchangeCodeAsync(
      { clientId, code: result.params.code, redirectUri },
      discovery,
    );
    return token.accessToken;
  };

  return { ready: Boolean(request), login };
}
```

- [ ] **Step 4: typecheck** — Run: `npm run typecheck 2>&1 | grep -v "app/login.tsx"` → 신규 파일 오류 0 (login.tsx 오류는 Task 1의 계획된 잔여).

- [ ] **Step 5: 커밋** — `신규: 카카오 로그인 훅과 애플 로그인 네이티브 설정`

---

### Task 3: login.tsx 전면 리라이트 (앱)

**Files:**
- Modify: `app/login.tsx` (전체 교체)

**Interfaces:**
- Consumes: Task 1의 `brandGradientStops`·`socialLogin`, Task 2의 `useKakaoLogin`/`hasKakaoClient`.

- [ ] **Step 1: 전체 교체** — 아래 코드로 파일을 통째로 교체:

```tsx
import * as Google from 'expo-auth-session/providers/google';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { API_BASE_URL } from '@/api/client';
import { hasKakaoClient, useKakaoLogin } from '@/hooks/useKakaoLogin';
import { useAuth } from '@/store/auth';
import { brandGradientStops, darkColors, hairline, radius, sans, spacing, typeScale } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

/** 애플 모듈은 iOS에서만 로드 (웹·안드로이드 번들에서 배제, Expo Go 미포함 대비 try/catch). */
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
 * 로그인 — 다크 고정 브랜드 틸 그라데이션.
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
    if (!Apple) return;
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
    <LinearGradient colors={[...brandGradientStops]} style={styles.fill}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.brand}>
            <Image
              source={require('../assets/logo-dark.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="bookey"
            />
            <Text style={styles.tagline}>
              읽기로 한 책을 끝까지.{'\n'}읽은 사람만 리뷰를 쓴다.
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="이메일"
              placeholderTextColor={darkColors.textFaint}
            />
            {isSignup ? (
              <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="닉네임"
                placeholderTextColor={darkColors.textFaint}
              />
            ) : null}
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="비밀번호 (8자 이상)"
              placeholderTextColor={darkColors.textFaint}
            />
            <Pressable
              onPress={submitEmail}
              disabled={busy}
              style={({ pressed }) => [styles.cta, (pressed || busy) && styles.pressed]}
              accessibilityRole="button"
            >
              {emailLoading
                ? <ActivityIndicator color={darkColors.onAccent} />
                : <Text style={styles.ctaLabel}>{isSignup ? '가입하기' : '로그인'}</Text>}
            </Pressable>
            <Pressable
              onPress={() => { setIsSignup(!isSignup); setError(null); }}
              disabled={busy}
              accessibilityRole="button"
              style={styles.switchLine}
            >
              <Text style={styles.switchLabel}>
                {isSignup ? '이미 계정이 있어요 · 로그인' : '처음이신가요? 이메일로 가입하기'}
              </Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
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
    </LinearGradient>
  );
}

const BUTTON_HEIGHT = 48;

const styles = StyleSheet.create({
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
  brand: { alignItems: 'center', gap: spacing.lg },
  logo: { width: 72, height: 72 },
  tagline: {
    ...typeScale.body,
    color: darkColors.textMuted,
    textAlign: 'center',
  },
  form: { gap: spacing.sm },
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
  switchLine: { alignItems: 'center', paddingVertical: spacing.sm },
  switchLabel: { ...typeScale.label, color: darkColors.textMuted },
  error: { ...typeScale.caption, color: darkColors.danger, textAlign: 'center' },
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
  devInfo: { gap: spacing.xs, alignItems: 'center' },
  devLine: { ...typeScale.caption, color: darkColors.textFaint, fontVariant: ['tabular-nums'] },
});
```

주의: `danger`가 `ColorTokens`에 있는지 확인(`src/theme/palette.ts`) — 없으면 `warn` 사용.

- [ ] **Step 2: typecheck** — Run: `npm run typecheck` → exit 0 (Task 1의 잔여 오류 해소 확인).

- [ ] **Step 3: 커밋** — `수정: 로그인 화면 OTT 리라이트 — 틸 그라데이션·이메일 우선·소셜 3종`

---

### Task 4: 깨진 본문 400 처리 + 시드 비밀번호 (백엔드)

**Files:**
- Modify: `server/src/main/java/app/bookey/common/error/GlobalExceptionHandler.java`
- Create: `server/src/test/java/app/bookey/common/error/GlobalExceptionHandlerTest.java`
- Modify: (앱 저장소) `.superpowers/seed-dummy.sql`

**Interfaces:**
- Consumes: 기존 `ErrorCode.INVALID_REQUEST`(400), `ErrorResponse.of(code, message)`.

- [ ] **Step 1: 실패 테스트 작성** — `GlobalExceptionHandlerTest.java`:

```java
package app.bookey.common.error;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;

import java.io.ByteArrayInputStream;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void 깨진_요청_본문은_400으로_매핑된다() {
        HttpMessageNotReadableException e = new HttpMessageNotReadableException(
                "broken body", new MockHttpInputMessage(new ByteArrayInputStream(new byte[0])));

        ResponseEntity<ErrorResponse> response = handler.handleUnreadable(e);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().code()).isEqualTo("INVALID_REQUEST");
    }
}
```

주의: `ErrorResponse`가 record가 아니면 `.code()` 접근자를 실제 형태(`getCode()`)에 맞춘다. `spring-test`(MockHttpInputMessage)는 기존 테스트 의존성에 포함 — 없으면 `org.springframework.mock` 대신 익명 `HttpInputMessage` 구현 사용.

- [ ] **Step 2: 실패 확인** — Run: `JAVA_HOME='C:\Users\ANT010\.jdks\corretto-21.0.7' ./mvnw -q test -Dtest=GlobalExceptionHandlerTest` → 컴파일 실패(`handleUnreadable` 없음).

- [ ] **Step 3: 핸들러 추가** — `GlobalExceptionHandler.java`의 `handleUnexpected` 위에:

```java
@ExceptionHandler(HttpMessageNotReadableException.class)
public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
    log.debug("Unreadable request body - {}", e.getMessage());
    return ResponseEntity.status(ErrorCode.INVALID_REQUEST.getStatus())
            .body(ErrorResponse.of(ErrorCode.INVALID_REQUEST, "요청 본문을 해석할 수 없습니다."));
}
```

import 추가: `org.springframework.http.converter.HttpMessageNotReadableException`.

- [ ] **Step 4: 테스트 통과 + 회귀** — Run: `JAVA_HOME='C:\Users\ANT010\.jdks\corretto-21.0.7' ./mvnw -q test` → 전부 통과.

- [ ] **Step 5: 시드 비밀번호 (앱 저장소 파일)** — `.superpowers/seed-dummy.sql`의 `COMMIT;` 직전에 추가:

```sql
-- 4) dev 로그인용 비밀번호 (password1234) — tester1·tester로 이메일 로그인 가능
UPDATE users SET password_hash = '$2a$10$MfznblzpgKG9rwWuSZzVg.j8THGqE5thF1z5mIy85Ln/cCScP836a'
WHERE handle IN ('tester1', 'tester') AND password_hash IS NULL;
```

- [ ] **Step 6: 커밋** — 백엔드: `수정: 깨진 요청 본문을 400으로 매핑` / 앱(feature/login-redesign): `수정: 시드에 dev 로그인 비밀번호 추가`

---

## 검증 (컨트롤러가 최종 수행)

1. 백엔드 `mvnw test` 전체 통과, 앱 `npm run typecheck` exit 0.
2. 시드 UPDATE를 dev DB에 적용(`docker exec -i bookey-postgres psql -U bookey -d bookey`), probe 계정(probea·probeutf8) 삭제.
3. 백엔드 서버 재시작(새 핸들러 반영) 후 curl: 깨진 본문 → 400, 정상 가입→로그인→`/me` → 200.
4. 웹(:8083)에서 `tester1@dev.local` / `password1234` 로그인 → 홈 진입(더미 서재 확인). 신규 가입도 성공.
5. 레이아웃 육안: 그라데이션·로고·이메일 우선·"또는"·카카오/구글 게이트(`__DEV__` 안내), 애플 부재(웹).
6. 양쪽 main 머지 → 브랜치 삭제 → 메모리 갱신.
