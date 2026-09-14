import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getTokens, setTokens, clearTokens } from '@/store/tokenStorage';

/** extra.apiBaseUrl 도 없는 최악의 경우에만 쓰는 값. */
const FALLBACK_API_URL = 'http://localhost:8080';

function isLoopback(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * API 베이스 URL 결정.
 *
 * 1. `EXPO_PUBLIC_API_URL` — 개발자 개인 오버라이드(.env.local). 있으면 무조건 이긴다.
 * 2. `app.json` 의 `extra.apiBaseUrl` — 저장소에 커밋된 기본값. env 파일이 없는
 *    팀원·CI·EAS 빌드가 보게 되는 주소다.
 * 3. 기본값이 로컬 백엔드(localhost)를 가리킬 때에 한해 개발 서버 호스트(=맥의 LAN IP)로
 *    바꾼다. Expo Go 를 실제 기기에서 열면 localhost 는 폰 자신을 가리키기 때문이다.
 *    기본값이 원격 주소면 이 치환은 건너뛴다 — 로컬 백엔드를 위한 장치일 뿐이다.
 */
function resolveBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) {
    return override;
  }

  const configured =
    (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl
    ?? FALLBACK_API_URL;

  if (Platform.OS === 'web' || !isLoopback(configured)) {
    return configured;
  }

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${new URL(configured).port || '8080'}`;
  }
  return configured;
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
};

let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const tokens = await getTokens();
  if (!tokens?.refreshToken) {
    return false;
  }
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!response.ok) {
    await clearTokens();
    return false;
  }
  const data = await response.json();
  await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return true;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query } = options;

  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  // multipart 는 boundary 가 붙은 Content-Type 을 런타임이 직접 만들어야 하므로 헤더를 지정하지 않는다.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const send = async (): Promise<Response> => {
    // FormData(파일 업로드)는 런타임이 boundary 포함 Content-Type 을 직접 붙여야 한다.
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers: Record<string, string> = isForm ? {} : { 'Content-Type': 'application/json' };
    if (auth) {
      const tokens = await getTokens();
      if (tokens?.accessToken) {
        headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
    }
    return fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  };

  let response = await send();

  // 액세스 토큰 만료 시 1회만 갱신을 시도한다 (동시 요청은 하나의 갱신을 공유).
  if (response.status === 401 && auth) {
    refreshing = refreshing ?? refreshAccessToken();
    const refreshed = await refreshing;
    refreshing = null;
    if (refreshed) {
      response = await send();
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.code ?? 'UNKNOWN',
      data?.message ?? '요청을 처리하지 못했습니다.',
    );
  }
  return data as T;
}
