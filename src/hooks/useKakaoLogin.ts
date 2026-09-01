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
