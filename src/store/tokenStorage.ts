import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'bookey.tokens';

export type Tokens = { accessToken: string; refreshToken: string };

// 인증된 페이지의 병렬 요청은 키체인을 매번 다시 읽지 않고 같은 메모리 값을 쓴다.
let cachedTokens: Tokens | null | undefined;
let readingTokens: Promise<Tokens | null> | null = null;
let revision = 0;

/** 네이티브는 SecureStore(키체인), 웹은 AsyncStorage 를 쓴다. */
const storage = {
  async get(key: string) {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') {
      return AsyncStorage.setItem(key, value);
    }
    return SecureStore.setItemAsync(key, value);
  },
  async remove(key: string) {
    if (Platform.OS === 'web') {
      return AsyncStorage.removeItem(key);
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export async function getTokens(): Promise<Tokens | null> {
  if (cachedTokens !== undefined) return cachedTokens;
  if (readingTokens) return readingTokens;
  const atStart = revision;
  const pending = storage.get(KEY).then((raw) => {
    // 읽는 사이 로그인·토큰 갱신·로그아웃이 끝났다면 오래된 값을 되살리지 않는다.
    if (revision !== atStart) return cachedTokens ?? null;
    cachedTokens = raw ? (JSON.parse(raw) as Tokens) : null;
    return cachedTokens;
  });
  readingTokens = pending;
  try {
    return await pending;
  } finally {
    if (readingTokens === pending) readingTokens = null;
  }
}

export async function setTokens(tokens: Tokens) {
  await storage.set(KEY, JSON.stringify(tokens));
  revision += 1;
  cachedTokens = { ...tokens };
}

export async function clearTokens() {
  await storage.remove(KEY);
  revision += 1;
  cachedTokens = null;
}
