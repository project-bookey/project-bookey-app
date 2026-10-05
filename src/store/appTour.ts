import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { SectionRoute } from '@/components/pager/sectionPager';

/**
 * 둘러보기 한 단계 — 메인 탭 한 구역을 보여 주고, 그 구역의 하단 탭 아이콘과 화면 속 핵심 요소를 함께 비춘다.
 * 하단 탭은 아이콘만 있어 이름(홈·엽서·나)을 익힐 곳이 여기뿐이다 — 제목은 탭의 접근성 라벨과 같게 둔다.
 */
export type TourStep = {
  /** 이 단계에서 보여 줄 메인 탭 구역. */
  section: SectionRoute;
  /** 그 구역의 하단 탭 아이콘(`nav-<구역>`)도 비출지. */
  nav: boolean;
  /** 화면 속 핵심 요소의 TourTarget id. */
  target: string;
  /** 헤더·하단 바처럼 페이지 밖에 있는 요소 — 페이지 영역으로 자르지 않는다. */
  inHeader?: boolean;
  title: string;
  body: string;
};

export const APP_TOUR_STEPS: readonly TourStep[] = [
  {
    section: 'home',
    nav: true,
    target: 'home-search',
    title: '홈',
    body: "내 책이 모이는 곳이에요. 책을 찾아 서재에 담고, 책 화면에서 '독서 시작'을 누르면 타이머가 시간을 재요.",
  },
  {
    section: 'plaza',
    nav: true,
    target: 'plaza-compose',
    inHeader: true,
    title: '광장',
    body: '다른 독자들의 독후감이 올라와요. 내 독후감은 오른쪽 아래 연필을 눌러 써요.',
  },
  {
    section: 'clubs',
    nav: true,
    target: 'club-actions',
    inHeader: true,
    title: '클럽',
    body: '함께 읽을 사람들과 클럽을 꾸려요. 오른쪽 아래 버튼을 누르면 초대 코드로 참가하거나 클럽을 만들 수 있어요. 모임을 잡아 모임 노트도 같이 써요.',
  },
  {
    section: 'messenger',
    nav: true,
    target: 'header-chat',
    inHeader: true,
    title: '엽서',
    body: '독후감이나 독자 페이지에서 주고받은 엽서가 여기 모여요. 봉투는 받은 엽서, 종이비행기는 보낸 엽서예요. 답장이 오가면 열리는 채팅은 왼쪽 위 말풍선에서 봐요.',
  },
  {
    section: 'messenger',
    nav: false,
    target: 'header-bookmarks',
    inHeader: true,
    title: '책갈피',
    body: '앱 안에서 쓰는 화폐예요. 엽서·우표로 바꾸거나 클럽 자리를 늘릴 때 써요. 누르면 더 살 수 있어요.',
  },
  {
    section: 'profile',
    nav: true,
    target: 'profile-settings',
    title: '나',
    body: "내 서재와 기록, 지갑과 출석이 여기 있어요. 이 안내는 설정의 '앱 사용법 다시 보기'에서 다시 볼 수 있어요.",
  },
];

/** v2 — 2026-10-04 둘러보기를 새로 짜면서 키를 바꿔, 예전 것을 본 사람도 한 번 더 보게 했다. 기기마다 따로 남는다. */
const seenKey = (userId: number) => `bookey.appTourSeen.v2.${userId}`;

/** 지금 '본 적 있음'을 읽고 있는 사용자 — 읽는 사이 계정이 바뀌면 결과를 버린다. */
let checkingFor: number | null = null;

type AppTourState = {
  active: boolean;
  step: number;
  /** 지금 사용자의 '본 적 있음'을 읽었는지. 공지 팝업은 이게 참이고 둘러보기가 꺼져 있을 때만 뜬다. */
  checked: boolean;
  start: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  /** 로그아웃·계정 전환 — 진행 중이던 둘러보기를 거두고 다음 사용자를 위해 다시 읽게 한다. */
  reset: () => void;
  startIfFirstLogin: (userId: number) => Promise<void>;
  markSeen: (userId: number) => void;
};

export const useAppTour = create<AppTourState>((set, get) => ({
  active: false,
  step: 0,
  checked: false,
  start: () => set({ active: true, step: 0 }),
  next: () => set((state) => ({ step: Math.min(state.step + 1, APP_TOUR_STEPS.length - 1) })),
  prev: () => set((state) => ({ step: Math.max(state.step - 1, 0) })),
  stop: () => set({ active: false, step: 0 }),
  reset: () => {
    checkingFor = null;
    set({ active: false, step: 0, checked: false });
  },
  startIfFirstLogin: async (userId) => {
    if (checkingFor === userId) return;
    checkingFor = userId;
    let seen = true;
    try {
      seen = (await AsyncStorage.getItem(seenKey(userId))) === '1';
    } catch {
      // 저장소를 못 읽으면 띄우지 않는다 — 저장소 문제로 매번 둘러보기가 뜨면 앱을 쓸 수 없다.
    }
    if (checkingFor !== userId) return;
    set(!seen && !get().active ? { checked: true, active: true, step: 0 } : { checked: true });
  },
  markSeen: (userId) => {
    AsyncStorage.setItem(seenKey(userId), '1').catch(() => {});
  },
}));
