import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/api/client';
import { authApi } from '@/api/endpoints';

/**
 * 카카오 로그인 — 서버가 중계한다(백엔드 KakaoLoginService).
 * 카카오는 리다이렉트 URI 로 http(s)만 받고 새 REST 키는 클라이언트 시크릿이 켜져 있어 앱이 코드를 직접 토큰으로 바꿀 수 없다.
 * 로그인 창으로 서버의 authorize 를 열면 서버가 카카오를 거쳐 교환 코드를 붙여 bookey://auth/kakao 로 돌려보내고,
 * 앱은 그 코드와 code_verifier(PKCE)로 카카오 accessToken 을 받는다 — 백엔드 /auth/social(KAKAO)에 넘길 값.
 * 키는 서버에만 있다. 복귀 주소가 화면을 옮기지 않게 하는 것은 app/+native-intent.tsx.
 */

/** 서버가 결과를 돌려보내는 앱 주소 — 서버 허용 목록(KAKAO_LOGIN_APP_REDIRECTS)과 글자까지 같아야 한다. */
const redirectUri = 'bookey://auth/kakao';

/** iOS 로그인 창은 bookey:// 를 스스로 받아 Expo Go 에서도 되지만, Android Expo Go 와 웹은 이 주소를 받지 못한다. */
const canReceiveRedirect = Platform.OS === 'ios'
  || (Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient);

const FAILED = '카카오 로그인을 마치지 못했어요. 다시 시도해 주세요.';
const UNAVAILABLE = '지금은 카카오 로그인을 쓸 수 없어요.';

function randomHex(bytes: number) {
  return Array.from(Crypto.getRandomBytes(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 성공 시 카카오 accessToken, 사용자가 창을 닫거나 동의 화면에서 취소하면 null. */
export async function kakaoLogin(): Promise<string | null> {
  if (!canReceiveRedirect) {
    throw new Error(__DEV__ ? '카카오 로그인은 iOS나 Android 개발 빌드에서 확인할 수 있어요. (Android Expo Go·웹 제외)' : UNAVAILABLE);
  }
  const verifier = randomHex(32);
  const state = randomHex(16);
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const authorizeUrl = new URL(`${API_BASE_URL}/api/v1/auth/kakao/authorize`);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl.toString(), redirectUri);
  if (result.type !== 'success') return null;

  const params = new URL(result.url).searchParams;
  // 내가 연 로그인 창의 결과인지 먼저 본다 — 만료돼 서버가 state 없이 돌려보낸 경우도 여기서 걸린다.
  if (params.get('state') !== state) throw new Error(FAILED);
  const error = params.get('error');
  if (error === 'access_denied') return null;
  if (error === 'unavailable') throw new Error(UNAVAILABLE);
  const code = params.get('code');
  if (error || !code) throw new Error(FAILED);

  const { accessToken } = await authApi.kakaoToken(code, verifier);
  return accessToken;
}
