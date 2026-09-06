import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 온보딩 노출 여부 — 기기당 1회. 본 적이 없으면 로그인 대신 온보딩으로 보낸다.
 * 저장 실패(프라이빗 모드 등)는 "본 것"으로 쳐서 무한 온보딩을 막는다.
 */
const SEEN_KEY = 'bookey.onboardingSeen';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === '1';
  } catch {
    return true;
  }
}

export function markOnboardingSeen(): void {
  AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
}
