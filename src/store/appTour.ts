import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export const APP_TOUR_STEPS = [
  { route: '/home', target: 'home-search', title: '책을 찾아보세요', body: '제목이나 저자로 검색해 읽을 책을 서재에 담을 수 있어요.' },
  { route: '/plaza', target: 'plaza-actions', title: '광장에서 기록을 나눠요', body: '독후감과 밑줄을 보고, 내 기록도 바로 남길 수 있어요.' },
  { route: '/clubs', target: 'club-actions', title: '함께 읽는 모임', body: '초대 코드로 참가하거나 새로운 독서 모임을 만들어보세요.' },
  { route: '/messenger', target: 'messenger-panes', title: '엽서에서 대화까지', body: '받은 엽서와 보낸 엽서, 열린 채팅을 한곳에서 확인해요.' },
  { route: '/profile', target: 'profile-wallet', title: '내 지갑', body: '책갈피를 엽서와 우표로 교환하고 보유 수량을 확인해요.' },
  { route: '/profile', target: 'profile-settings', title: '내 방식대로 설정해요', body: '알림 말투와 화면 테마를 바꾸고 튜토리얼도 다시 볼 수 있어요.' },
] as const;

const seenKey = (userId: number) => `bookey.spotlightTourSeen.${userId}`;

type AppTourState = {
  active: boolean;
  step: number;
  start: () => void;
  next: () => void;
  stop: () => void;
  startIfFirstLogin: (userId: number) => Promise<void>;
  markSeen: (userId: number) => Promise<void>;
};

export const useAppTour = create<AppTourState>((set, get) => ({
  active: false,
  step: 0,
  start: () => set({ active: true, step: 0 }),
  next: () => set((state) => ({ step: Math.min(state.step + 1, APP_TOUR_STEPS.length - 1) })),
  stop: () => set({ active: false, step: 0 }),
  startIfFirstLogin: async (userId) => {
    try {
      if ((await AsyncStorage.getItem(seenKey(userId))) !== '1' && !get().active) {
        set({ active: true, step: 0 });
      }
    } catch {
      // 저장소 접근 실패가 앱 사용을 막아서는 안 된다.
    }
  },
  markSeen: async (userId) => {
    try { await AsyncStorage.setItem(seenKey(userId), '1'); } catch {}
  },
}));
