import { create } from 'zustand';

/**
 * 온보딩에서 고른 선호 카테고리·책 — 가입 전(비로그인)의 선택을 담아 두었다가
 * 가입 성공 직후 서버에 반영한다(카테고리 → PATCH /me, 책 → 서재 WANT_TO_READ).
 * 메모리 전용이다 — 앱을 껐다 켜면 사라지지만, 온보딩도 처음부터 다시 시작하므로 문제없다.
 */
type OnboardingState = {
  categories: string[];
  bookIds: number[];
  setCategories: (categories: string[]) => void;
  toggleBook: (bookId: number, max: number) => void;
  clear: () => void;
};

export const useOnboarding = create<OnboardingState>((set) => ({
  categories: [],
  bookIds: [],
  setCategories: (categories) => set({ categories }),
  toggleBook: (bookId, max) => set((state) => {
    if (state.bookIds.includes(bookId)) {
      return { bookIds: state.bookIds.filter((id) => id !== bookId) };
    }
    if (state.bookIds.length >= max) {
      return state;
    }
    return { bookIds: [...state.bookIds, bookId] };
  }),
  clear: () => set({ categories: [], bookIds: [] }),
}));
