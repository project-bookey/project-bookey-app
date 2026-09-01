import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'bookey.themePreference';

export type ThemePreference = 'system' | 'light' | 'dark';

const VALID: readonly string[] = ['system', 'light', 'dark'];

type ThemePreferenceState = {
  preference: ThemePreference;
  restore: () => Promise<void>;
  setPreference: (preference: ThemePreference) => void;
};

/**
 * 앱 내 화면 테마 선호 — 기본 'system'(기기 설정 추종).
 * 비밀값이 아니므로 tokenStorage와 달리 분기 없이 전 플랫폼 AsyncStorage만 쓴다.
 */
export const useThemePreference = create<ThemePreferenceState>((set) => ({
  preference: 'system',

  restore: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw && VALID.includes(raw)) {
        set({ preference: raw as ThemePreference });
      }
    } catch {
      // 읽기 실패 시 기본값 'system' 유지 — 앱 동작에 지장 없음.
    }
  },

  setPreference: (preference) => {
    set({ preference });
    // 저장은 fire-and-forget — 저장 실패가 세션 중 전환을 막지 않는다.
    AsyncStorage.setItem(KEY, preference).catch(() => {});
  },
}));
