import { router } from '@/navigation';
import { create } from 'zustand';

/** 메인 탭(PagerView) 다섯 구역 — `app/(tabs)/_layout.tsx` 의 페이지 순서와 같은 이름. */
export type SectionRoute = 'plaza' | 'clubs' | 'home' | 'messenger' | 'profile';

type SectionPagerState = {
  /** 포커스된 메인 탭 화면이 지금 보여 주는 구역. 하위 화면(설정·상세 등)이 위에 있으면 null. */
  shown: SectionRoute | null;
  /** 그 화면의 pager 를 직접 넘기는 함수 — URL 은 건드리지 않는다. */
  select: ((route: SectionRoute) => void) | null;
  /** 값을 게시한 (tabs) 인스턴스 — 두 벌이 떠 있을 때 남이 게시한 값을 지우지 않게 가른다. */
  owner: object | null;
  /** openSection 이 맡겨 둔 구역 — 메인 탭이 포커스되고 pager 가 자리를 잡으면 그 화면이 넘기고 비운다. */
  pending: SectionRoute | null;
};

/**
 * 메인 탭 pager 의 '지금 보이는 구역'과 넘기기 손잡이.
 *
 * 메인 탭은 PagerView 라 탭을 누르거나 밀어도 URL 이 그대로다 — 그래서 pathname 으로는
 * 어느 구역이 보이는지 알 수 없다. 포커스된 `(tabs)` 레이아웃이 여기에 게시하고,
 * 둘러보기처럼 구역을 옮겨야 하는 쪽은 `showSection` 으로 pager 를 넘긴다.
 */
export const useSectionPager = create<SectionPagerState>(() => ({
  shown: null, select: null, owner: null, pending: null,
}));

/** 포커스된 메인 탭 화면의 pager 를 그 구역으로 넘긴다. 메인 탭이 포커스돼 있지 않으면 아무것도 하지 않는다. */
export function showSection(route: SectionRoute) {
  useSectionPager.getState().select?.(route);
}

/**
 * 어느 화면에서든 메인 탭의 한 구역을 연다 — 엽서 알림에서 엽서 구역으로, 내 프로필에서 '나'로 갈 때 쓴다.
 *
 * `router.navigate('/messenger')`·`<Redirect href="/profile">` 처럼 경로로 가면 하위 화면 위에서는
 * 메인 탭이 한 벌 더 쌓이고, 메인 탭 URL 은 보이는 구역을 따라가지 않아 돌아가도 그 구역이 열리지 않는다.
 * 그래서 dismissTo 로 쌓인 화면을 걷고 원래 메인 탭으로 돌아간 뒤(없으면 지금 화면을 메인 탭으로 바꾼다),
 * pager 는 맡겨 둔 구역으로 메인 탭 레이아웃이 넘긴다. params 는 그 구역 화면이 읽는 주소 값이다.
 */
export function openSection(route: SectionRoute, params?: Record<string, string>) {
  useSectionPager.setState({ pending: route });
  router.dismissTo(params ? { pathname: `/${route}`, params } : `/${route}`);
}
