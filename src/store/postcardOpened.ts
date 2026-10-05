import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type OpenedState = {
  opened: Record<string, true>;
  markOpened: (userId: number, postcardId: number) => void;
};

/** 서버에 읽음 필드가 없어 본문 없이 계정별 읽은 엽서 ID만 기기에 보관한다. */
export const usePostcardOpened = create<OpenedState>()(persist(
  (set) => ({
    opened: {},
    markOpened: (userId, postcardId) => set((state) => {
      const key = `${userId}:${postcardId}`;
      return state.opened[key] ? state : { opened: { ...state.opened, [key]: true } };
    }),
  }),
  {
    name: 'bookey.postcardOpened',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (state) => ({ opened: state.opened }),
    merge: (persisted, current) => ({
      ...current,
      opened: { ...(persisted as Partial<OpenedState> | undefined)?.opened, ...current.opened },
    }),
  },
));
