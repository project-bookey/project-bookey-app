import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { hasKakaoClient, useKakaoLogin } from '@/hooks/useKakaoLogin';

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'APPLE' | 'KAKAO' | 'GOOGLE';

/** 애플 모듈은 iOS에서만 실행 로드 (번들엔 포함되나 다른 플랫폼에선 실행되지 않음, Expo Go 미포함 대비 try/catch). */
export let Apple: typeof import('expo-apple-authentication') | null = null;
if (Platform.OS === 'ios') {
  try {
    Apple = require('expo-apple-authentication');
  } catch {
    Apple = null;
  }
}

/** 구글 클라이언트 ID — 로그인과 연동이 같은 값을 쓴다. 비어 있으면 자리값을 넣어 훅이 깨지지 않게 한다. */
export const googleClientIds = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'not-configured',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'not-configured',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || 'not-configured',
};

export const hasGoogleClient = Boolean(
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
);

/**
 * 소셜 공급자의 토큰만 받아 온다 — 백엔드에 넘길 값(애플·구글은 ID 토큰, 카카오는 access token).
 * 설정의 '소셜 계정 연동'이 쓴다. 사용자가 창을 닫으면 null, 설정이 없거나 실패하면 던진다.
 */
export function useSocialTokens() {
  const kakao = useKakaoLogin();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [googleRequest, , promptGoogle] = Google.useIdTokenAuthRequest({
    ...googleClientIds,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    Apple?.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const getToken = async (provider: SocialProvider): Promise<string | null> => {
    if (provider === 'APPLE') {
      if (!Apple) throw new Error('이 기기에서는 Apple 로그인을 쓸 수 없어요.');
      try {
        // 연동엔 이름·이메일이 필요 없다 — 계정 식별용 ID 토큰만 받는다.
        const credential = await Apple.signInAsync({ requestedScopes: [] });
        if (!credential.identityToken) throw new Error('Apple 인증 토큰을 받지 못했습니다.');
        return credential.identityToken;
      } catch (e) {
        if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return null;
        throw e;
      }
    }
    if (provider === 'KAKAO') {
      if (!hasKakaoClient) throw new Error('카카오 로그인 키가 아직 설정되지 않았습니다.');
      return kakao.login();
    }
    if (!hasGoogleClient || !googleRequest) throw new Error('Google 로그인 키가 아직 설정되지 않았습니다.');
    const result = await promptGoogle();
    if (result.type === 'success') return result.params.id_token ?? null;
    if (result.type === 'error') throw new Error('Google 인증을 완료하지 못했습니다.');
    return null;
  };

  return { getToken, appleAvailable };
}
