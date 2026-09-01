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
 * 앱 내 화면 테마 선호 — 기본 'dark'. 레거시 화면(다크 고정)이 남아 있는 동안
 * 시스템/라이트는 톤 불일치를 감수하는 명시적 선택이다. 전 화면 리디자인 완료 후
 * 'system' 기본 복귀 검토(수동 테마 전환 스펙 후속 메모).
 * 비밀값이 아니므로 tokenStorage와 달리 분기 없이 전 플랫폼 AsyncStorage만 쓴다.
 */
export const useThemePreference = create<ThemePreferenceState>((set) => ({
  preference: 'dark',

  restore: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw && VALID.includes(raw)) {
        set({ preference: raw as ThemePreference });
      }
    } catch {
      // 읽기 실패 시 기본값 'dark' 유지 — 앱 동작에 지장 없음.
    }
  },

  setPreference: (preference) => {
    set({ preference });
    // 저장은 fire-and-forget — 저장 실패가 세션 중 전환을 막지 않는다.
    AsyncStorage.setItem(KEY, preference).catch(() => {});
  },
}));
